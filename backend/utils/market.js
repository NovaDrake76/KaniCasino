const User = require("../models/User");
const Marketplace = require("../models/Marketplace");
const MarketSale = require("../models/MarketSale");
const BuyOrder = require("../models/BuyOrder");
const Notification = require("../models/Notification");
const { creditUser, recordTransaction, runAtomic, TX } = require("./economy");
const { marketFee, sellerNet } = require("./itemValue");
const { HOUSE, ESCROW } = require("./accounts");

// the house cut on a settled trade, booked to HOUSE so the three trade legs (buyer,
// seller, house) sum to zero. best-effort, like the rest of the ledger for now.
async function recordMarketFee({ price, buyerId, meta }) {
  const fee = marketFee(price);
  if (!fee) return;
  await recordTransaction({
    userId: HOUSE,
    type: TX.MARKET_FEE,
    direction: "credit",
    amount: fee,
    counterparty: null,
    meta: { ...meta, buyerId },
  });
}

// rebuild the inventory entry a listing represents. acquired now, so it sorts newest.
function inventoryEntryFrom(listing) {
  return {
    _id: listing.item,
    name: listing.itemName,
    image: listing.itemImage,
    rarity: listing.rarity,
    case: listing.case,
    createdAt: new Date(),
    uniqueId: listing.uniqueId,
  };
}

// put a claimed listing back on the market. the _id is preserved: clients hold it
// and buy by it, so minting a new one would 404 every honest buyer and let a broke
// account re-key a listing at will just by failing to pay for it.
function restoreListing(claimed) {
  return Marketplace.create({
    _id: claimed._id,
    sellerId: claimed.sellerId,
    item: claimed.item,
    case: claimed.case,
    uniqueId: claimed.uniqueId,
    price: claimed.price,
    itemName: claimed.itemName,
    itemImage: claimed.itemImage,
    rarity: claimed.rarity,
  });
}

// the durable price-history record. best-effort: a failed write must never break a
// settled trade, mirroring recordTransaction.
async function logSale({ listing, buyerId, price, viaOrder = false }) {
  try {
    return await MarketSale.create({
      item: listing.item,
      itemName: listing.itemName,
      rarity: listing.rarity,
      price,
      fee: marketFee(price),
      sellerNet: sellerNet(price),
      sellerId: listing.sellerId,
      buyerId,
      listingId: listing.uniqueId,
      viaOrder,
      soldAt: new Date(),
    });
  } catch (err) {
    console.error("logSale failed:", err);
    return null;
  }
}

// tell the seller their item sold. never throws into the trade.
async function notifySeller({ seller, buyerId, itemName, price, net, io }) {
  try {
    if (!seller) return;
    const message = `Your ${itemName} sold for K₽${price} (you received K₽${net})`;
    await Notification.create({
      senderId: buyerId,
      receiverId: seller._id,
      type: "message",
      title: "Item Sold",
      content: message,
    });
    if (io) {
      io.to(seller._id.toString()).emit("newNotification", { message });
      io.to(seller._id.toString()).emit("userDataUpdated", {
        walletBalance: seller.walletBalance,
        xp: seller.xp,
        level: seller.level,
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// buy a listing straight from the wallet. shared by POST /buy/:id and by a new buy
// order crossing resting listings. the atomic claim (findOneAndDelete) is the lock:
// exactly one caller can win a given listing.
async function purchaseListing({ listingId, buyerId, io }) {
  const claimed = await Marketplace.findOneAndDelete({ _id: listingId });
  if (!claimed) return { ok: false, code: 404, message: "Item no longer available" };

  if (String(claimed.sellerId) === String(buyerId)) {
    await restoreListing(claimed);
    return { ok: false, code: 400, message: "You can't buy your own listing" };
  }

  // debit the buyer, grant the item and write the row together; a failed row rolls the
  // charge back and the listing is restored, so nobody pays without a record
  const updatedBuyer = await runAtomic(async (session) => {
    const u = await User.findOneAndUpdate(
      { _id: buyerId, walletBalance: { $gte: claimed.price } },
      { $inc: { walletBalance: -claimed.price }, $push: { inventory: inventoryEntryFrom(claimed) } },
      { new: true, session }
    );
    if (!u) return null;
    // player-to-player, so the buyer and seller legs carry no counterparty; they and the
    // house fee row self-balance to zero
    await recordTransaction(
      {
        userId: buyerId,
        type: TX.MARKET_BUY,
        direction: "debit",
        amount: claimed.price,
        balanceAfter: u.walletBalance,
        counterparty: null,
        meta: { itemId: claimed.item, itemName: claimed.itemName, sellerId: claimed.sellerId, listingId: claimed.uniqueId },
      },
      session
    );
    return u;
  }).catch((err) => {
    console.error("market buyer charge rolled back:", err);
    return null;
  });
  if (!updatedBuyer) {
    await restoreListing(claimed);
    return { ok: false, code: 400, message: "Insufficient balance" };
  }

  const net = sellerNet(claimed.price);
  const seller = await creditUser(claimed.sellerId, net, 0, {
    type: TX.MARKET_SALE,
    counterparty: null,
    meta: {
      itemId: claimed.item,
      itemName: claimed.itemName,
      buyerId,
      listingId: claimed.uniqueId,
      price: claimed.price,
      fee: marketFee(claimed.price),
    },
  });

  // seller account is gone: reverse the buyer so their KP can't disappear
  if (!seller) {
    const reversed = await runAtomic(async (session) => {
      const r = await User.findOneAndUpdate(
        { _id: buyerId },
        { $inc: { walletBalance: claimed.price }, $pull: { inventory: { uniqueId: claimed.uniqueId } } },
        { new: true, session }
      );
      await recordTransaction(
        {
          userId: buyerId,
          type: TX.MARKET_BUY,
          direction: "credit",
          amount: claimed.price,
          balanceAfter: r ? r.walletBalance : undefined,
          counterparty: null,
          meta: { itemName: claimed.itemName, reversal: true, reason: "seller no longer exists" },
        },
        session
      );
      return r;
    });
    if (reversed && io) {
      io.to(buyerId.toString()).emit("userDataUpdated", {
        walletBalance: reversed.walletBalance,
        xp: reversed.xp,
        level: reversed.level,
      });
    }
    return { ok: false, code: 410, message: "Seller no longer available; purchase reversed" };
  }

  await recordMarketFee({
    price: claimed.price,
    buyerId,
    meta: { itemName: claimed.itemName, listingId: claimed.uniqueId },
  });

  await logSale({ listing: claimed, buyerId, price: claimed.price });
  if (io) {
    io.to(buyerId.toString()).emit("userDataUpdated", {
      walletBalance: updatedBuyer.walletBalance,
      xp: updatedBuyer.xp,
      level: updatedBuyer.level,
    });
  }
  await notifySeller({
    seller,
    buyerId,
    itemName: claimed.itemName,
    price: claimed.price,
    net,
    io,
  });

  return { ok: true, price: claimed.price, buyer: updatedBuyer, listing: claimed };
}

// cross an item the seller still holds straight into a resting buy order, WITHOUT
// ever publishing a listing (publishing first would let a third party front-run the
// bid at the lower ask, and would hand out an _id that the restore path invalidates).
// the bid is the resting side, so the trade clears at the ORDER's price: the price
// improvement goes to the seller. the buyer's KP is already escrowed, so no wallet
// moves here and no ledger row is written for the buyer: the escrow debit recorded at
// placement is the spend. writing one here would double-count it against the wallet.
async function fillOrderWithItem({ pending, order, io }) {
  const price = order.price;

  // claim exactly one unit of escrow; the filter is the guard, so two concurrent
  // sellers can never overfill the same order
  const claimedOrder = await BuyOrder.findOneAndUpdate(
    {
      _id: order._id,
      status: "open",
      escrow: { $gte: price },
      $expr: { $lt: ["$filled", "$quantity"] },
    },
    { $inc: { filled: 1, escrow: -price } },
    { new: true }
  );
  if (!claimedOrder) return { ok: false, reason: "order gone" };

  const grant = await User.updateOne(
    { _id: claimedOrder.userId },
    { $push: { inventory: inventoryEntryFrom(pending) } }
  );
  if (!grant.matchedCount) {
    await BuyOrder.updateOne({ _id: order._id }, { $inc: { filled: -1, escrow: price } });
    return { ok: false, reason: "buyer gone" };
  }

  const net = sellerNet(price);
  const seller = await creditUser(pending.sellerId, net, 0, {
    type: TX.MARKET_SALE,
    counterparty: null,
    meta: {
      itemId: pending.item,
      itemName: pending.itemName,
      buyerId: claimedOrder.userId,
      listingId: pending.uniqueId,
      price,
      fee: marketFee(price),
      viaOrder: true,
    },
  });

  if (!seller) {
    // seller gone: give the escrowed KP back to the buyer and take the item back
    await runAtomic(async (session) => {
      await User.updateOne(
        { _id: claimedOrder.userId },
        { $inc: { walletBalance: price }, $pull: { inventory: { uniqueId: pending.uniqueId } } },
        { session }
      );
      await recordTransaction(
        {
          userId: claimedOrder.userId,
          type: TX.MARKET_ORDER_REFUND,
          direction: "credit",
          amount: price,
          meta: { itemName: pending.itemName, reversal: true, reason: "seller no longer exists" },
        },
        session
      );
    });
    return { ok: false, reason: "seller gone" };
  }

  // the buyer paid at placement, so the payout comes out of escrow, not their wallet
  await recordTransaction({
    userId: ESCROW,
    type: TX.MARKET_ORDER_FILL,
    direction: "debit",
    amount: price,
    counterparty: null,
    meta: { orderId: String(order._id), sellerId: pending.sellerId, itemName: pending.itemName },
  });
  await recordMarketFee({
    price,
    buyerId: claimedOrder.userId,
    meta: { itemName: pending.itemName, orderId: String(order._id), viaOrder: true },
  });

  if (claimedOrder.filled >= claimedOrder.quantity) {
    await BuyOrder.updateOne({ _id: order._id, status: "open" }, { $set: { status: "filled" } });
  }

  await logSale({ listing: pending, buyerId: claimedOrder.userId, price, viaOrder: true });

  if (io) {
    io.to(claimedOrder.userId.toString()).emit("newNotification", {
      message: `Your buy order filled: ${pending.itemName} for K₽${price}`,
    });
  }
  await notifySeller({
    seller,
    buyerId: claimedOrder.userId,
    itemName: pending.itemName,
    price,
    net,
    io,
  });

  return { ok: true, price, order: claimedOrder };
}

// the best resting bid that a listing at `price` would cross (highest, then oldest)
function findMatchingOrder({ itemId, price, excludeUserId }) {
  return BuyOrder.findOne({
    item: itemId,
    status: "open",
    price: { $gte: price },
    userId: { $ne: excludeUserId },
    $expr: { $lt: ["$filled", "$quantity"] },
  }).sort({ price: -1, createdAt: 1 });
}

module.exports = {
  inventoryEntryFrom,
  restoreListing,
  logSale,
  purchaseListing,
  fillOrderWithItem,
  findMatchingOrder,
};
