const User = require("../models/User");
const Marketplace = require("../models/Marketplace");
const MarketSale = require("../models/MarketSale");
const BuyOrder = require("../models/BuyOrder");
const Notification = require("../models/Notification");
const { creditUser, recordTransaction, TX } = require("./economy");
const { marketFee, sellerNet } = require("./itemValue");

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

// put a claimed listing back on the market (same uniqueId, new _id)
function restoreListing(claimed) {
  return Marketplace.create({
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

  // debit the buyer and grant the item together, only if the balance covers it
  const updatedBuyer = await User.findOneAndUpdate(
    { _id: buyerId, walletBalance: { $gte: claimed.price } },
    { $inc: { walletBalance: -claimed.price }, $push: { inventory: inventoryEntryFrom(claimed) } },
    { new: true }
  );
  if (!updatedBuyer) {
    await restoreListing(claimed);
    return { ok: false, code: 400, message: "Insufficient balance" };
  }

  await recordTransaction({
    userId: buyerId,
    type: TX.MARKET_BUY,
    direction: "debit",
    amount: claimed.price,
    balanceAfter: updatedBuyer.walletBalance,
    meta: {
      itemId: claimed.item,
      itemName: claimed.itemName,
      sellerId: claimed.sellerId,
      listingId: claimed.uniqueId,
    },
  });

  const net = sellerNet(claimed.price);
  const seller = await creditUser(claimed.sellerId, net, 0, {
    type: TX.MARKET_SALE,
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
    const reversed = await User.findOneAndUpdate(
      { _id: buyerId },
      { $inc: { walletBalance: claimed.price }, $pull: { inventory: { uniqueId: claimed.uniqueId } } },
      { new: true }
    );
    await recordTransaction({
      userId: buyerId,
      type: TX.MARKET_BUY,
      direction: "credit",
      amount: claimed.price,
      balanceAfter: reversed ? reversed.walletBalance : undefined,
      meta: { itemName: claimed.itemName, reversal: true, reason: "seller no longer exists" },
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

// fill a fresh listing against a resting buy order. the bid is the resting side, so
// the trade clears at the ORDER's price (price improvement goes to the seller), and
// the buyer's KP is already escrowed. every step is reversible if the next one fails.
async function fillListingWithOrder({ listing, order, io }) {
  const claimed = await Marketplace.findOneAndDelete({ _id: listing._id });
  if (!claimed) return { ok: false, reason: "listing gone" };

  const price = order.price;

  // claim exactly one unit of escrow; the filter is the guard, so two concurrent
  // listings can never overfill the same order
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
  if (!claimedOrder) {
    await restoreListing(claimed);
    return { ok: false, reason: "order gone" };
  }

  // hand the item to the order's owner
  const grant = await User.updateOne(
    { _id: claimedOrder.userId },
    { $push: { inventory: inventoryEntryFrom(claimed) } }
  );
  if (!grant.matchedCount) {
    // buyer vanished: undo the escrow claim and put the listing back
    await BuyOrder.updateOne({ _id: order._id }, { $inc: { filled: -1, escrow: price } });
    await restoreListing(claimed);
    return { ok: false, reason: "buyer gone" };
  }

  const net = sellerNet(price);
  const seller = await creditUser(claimed.sellerId, net, 0, {
    type: TX.MARKET_SALE,
    meta: {
      itemId: claimed.item,
      itemName: claimed.itemName,
      buyerId: claimedOrder.userId,
      listingId: claimed.uniqueId,
      price,
      fee: marketFee(price),
      viaOrder: true,
    },
  });

  if (!seller) {
    // seller gone: give the escrowed KP back to the buyer and take the item back
    await User.updateOne(
      { _id: claimedOrder.userId },
      { $inc: { walletBalance: price }, $pull: { inventory: { uniqueId: claimed.uniqueId } } }
    );
    await recordTransaction({
      userId: claimedOrder.userId,
      type: TX.MARKET_ORDER_REFUND,
      direction: "credit",
      amount: price,
      meta: { itemName: claimed.itemName, reversal: true, reason: "seller no longer exists" },
    });
    return { ok: false, reason: "seller gone" };
  }

  // the buyer's escrow paid for this unit: ledger it as the purchase
  await recordTransaction({
    userId: claimedOrder.userId,
    type: TX.MARKET_BUY,
    direction: "debit",
    amount: price,
    meta: {
      itemId: claimed.item,
      itemName: claimed.itemName,
      sellerId: claimed.sellerId,
      listingId: claimed.uniqueId,
      fromEscrow: true,
    },
  });

  if (claimedOrder.filled >= claimedOrder.quantity) {
    await BuyOrder.updateOne({ _id: order._id, status: "open" }, { $set: { status: "filled" } });
  }

  await logSale({ listing: claimed, buyerId: claimedOrder.userId, price, viaOrder: true });

  if (io) {
    io.to(claimedOrder.userId.toString()).emit("newNotification", {
      message: `Your buy order filled: ${claimed.itemName} for K₽${price}`,
    });
  }
  await notifySeller({
    seller,
    buyerId: claimedOrder.userId,
    itemName: claimed.itemName,
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
  fillListingWithOrder,
  findMatchingOrder,
};
