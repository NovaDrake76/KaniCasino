import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getItemListings,
  getItemHistory,
  getItemOrders,
  getMyOrders,
  cancelBuyOrder,
  removeListing,
  ItemHistory,
  BuyOrder,
} from "../../services/market/MarketService";
import Item from "./Item";
import Pagination from "../../components/Pagination";
import Skeleton from "react-loading-skeleton";
import Monetary from "../../components/Monetary";
import PriceChart from "../../components/PriceChart";
import { rarityColor, rarityName } from "../../utils/rarity";
import { IMarketItem } from "../../components/Types";
import SellItemModal from "./SellItemModal";
import ConfirmPurchaseModal from "./ConfirmPurchaseModal";
import PlaceBuyOrderModal from "./PlaceBuyOrderModal";

interface ItemData {
  totalPages: number;
  currentPage: number;
  items: IMarketItem[];
}

const defaultItem: IMarketItem = {
  _id: "",
  sellerId: { _id: "", username: "" },
  item: { _id: "", name: "", image: "", uniqueId: "" },
  price: 0,
  itemName: "",
  itemImage: "",
  __v: 0,
  uniqueId: "",
};

const RANGES = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "lifetime", label: "Lifetime" },
];

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; accent?: string }> = ({
  label,
  value,
  hint,
  accent,
}) => (
  <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2 min-w-0">
    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
    <span className={`text-base font-semibold truncate ${accent || "text-ink"}`}>{value}</span>
    {hint && <span className="text-[10px] text-ink-faint truncate">{hint}</span>}
  </div>
);

const ItemPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const [items, setItems] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [loadingRemoval, setLoadingRemoval] = useState<boolean>(false);
  const [openBuyModal, setOpenBuyModal] = useState<boolean>(false);
  const [openSellModal, setOpenSellModal] = useState<boolean>(false);
  const [openOrderModal, setOpenOrderModal] = useState<boolean>(false);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<IMarketItem>(defaultItem);

  const [history, setHistory] = useState<ItemHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [range, setRange] = useState<string>("week");
  const [book, setBook] = useState<{ price: number; quantity: number }[]>([]);
  const [myOrders, setMyOrders] = useState<BuyOrder[]>([]);

  const fetchItemListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getItemListings(itemId as string, page);
      setItems(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [itemId, page]);

  const fetchMarketData = useCallback(async () => {
    if (!itemId) return;
    try {
      const [h, o] = await Promise.all([getItemHistory(itemId, range), getItemOrders(itemId)]);
      setHistory(h);
      setBook(o.orders || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingHistory(false);
    }
    // my orders only exist when logged in; a failure here is not an error state
    try {
      const mine = await getMyOrders();
      setMyOrders((mine.orders || []).filter((o) => String(o.item) === String(itemId)));
    } catch {
      setMyOrders([]);
    }
  }, [itemId, range]);

  useEffect(() => {
    if (refresh) {
      fetchItemListings();
      fetchMarketData();
      setRefresh(false);
    }
  }, [refresh, fetchItemListings, fetchMarketData]);

  useEffect(() => {
    fetchItemListings();
  }, [fetchItemListings]);

  useEffect(() => {
    setLoadingHistory(true);
    fetchMarketData();
  }, [fetchMarketData]);

  const buyItem = (item: IMarketItem) => {
    setSelectedItem(item);
    setOpenBuyModal(true);
  };

  const removeItem = async (item: IMarketItem) => {
    setLoadingRemoval(true);
    try {
      await removeListing(item.uniqueId);
      setRefresh(true);
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingRemoval(false);
    }
  };

  const cancelOrder = async (id: string) => {
    try {
      const res = await cancelBuyOrder(id);
      toast.success(`Order cancelled, K₽${res.refunded} refunded`);
      setRefresh(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not cancel the order");
    }
  };

  const stats = history?.stats;
  const item = history?.item;
  const color = item ? rarityColor(item.rarity) : "#ffffff";

  return (
    <div className="flex flex-col w-full items-center">
      <SellItemModal isOpen={openSellModal} onClose={() => setOpenSellModal(false)} setRefresh={setRefresh} />
      <ConfirmPurchaseModal
        isOpen={openBuyModal}
        onClose={() => setOpenBuyModal(false)}
        item={selectedItem}
        setRefresh={setRefresh}
      />
      {item && (
        <PlaceBuyOrderModal
          isOpen={openOrderModal}
          onClose={() => setOpenOrderModal(false)}
          item={{ _id: item._id, name: item.name, image: item.image }}
          stats={stats}
          onPlaced={() => setRefresh(true)}
        />
      )}

      <div className="w-full max-w-[1312px] px-4 md:px-8 py-6 flex flex-col gap-6">
        {/* item header */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <div
            className="w-20 h-20 shrink-0 rounded-lg bg-surface-nav flex items-center justify-center border-b-4"
            style={{ borderColor: color }}
          >
            {item ? (
              <img src={item.image} alt={item.name} className="max-h-16 max-w-16 object-contain" />
            ) : (
              <Skeleton width={56} height={56} />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl font-bold truncate" style={{ color }}>
              {item ? item.name : <Skeleton width={180} />}
            </h1>
            <span className="text-xs" style={{ color }}>
              {item ? rarityName(item.rarity) : ""}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setOpenOrderModal(true)}
              className="px-4 h-10 rounded-md border border-accent-gold/50 text-accent-gold text-sm font-semibold hover:bg-accent-gold/10"
            >
              Place buy order
            </button>
            <button
              onClick={() => setOpenSellModal(true)}
              className="px-4 h-10 rounded-md bg-accent hover:bg-accent-light text-sm font-semibold text-white"
            >
              Sell an item
            </button>
          </div>
        </div>

        {/* the numbers a trader actually needs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat
            label="Lowest listing"
            value={stats?.lowestListing ? <Monetary value={stats.lowestListing} /> : "None"}
            hint={stats ? `${stats.totalListings} on sale` : ""}
            accent="text-accent"
          />
          <Stat
            label="Median (7d)"
            value={stats?.median7d ? <Monetary value={stats.median7d} /> : "No sales"}
            hint={stats ? `${stats.volume7d} sold` : ""}
          />
          <Stat
            label="Median (30d)"
            value={stats?.median30d ? <Monetary value={stats.median30d} /> : "No sales"}
            hint={stats ? `${stats.volume30d} sold` : ""}
          />
          <Stat
            label="Best buy order"
            value={stats?.bestBid ? <Monetary value={stats.bestBid} /> : "No bids"}
            accent="text-accent-gold"
          />
          <Stat
            label="House floor"
            value={stats ? <Monetary value={stats.floor} /> : "-"}
            hint="instant sell price"
            accent="text-ink-muted"
          />
        </div>

        {/* price history */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-ink">Median sale prices</h2>
            <div className="inline-flex rounded-lg border border-line overflow-hidden">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    range === r.key ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <PriceChart points={history?.points || []} floor={stats?.floor} height={240} loading={loadingHistory} />
          {stats?.lastSale && (
            <span className="text-xs text-ink-muted">
              Last sold for <Monetary value={stats.lastSale.price} /> on{" "}
              {new Date(stats.lastSale.soldAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>

        {/* buy orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Buy orders</h3>
            {book.length === 0 ? (
              <span className="text-sm text-ink-muted py-2">Nobody is bidding on this item yet.</span>
            ) : (
              <div className="flex flex-col gap-1">
                {book.slice(0, 6).map((b) => (
                  <div key={b.price} className="flex items-center justify-between text-sm">
                    <span className="text-accent-gold font-semibold">
                      <Monetary value={b.price} />
                    </span>
                    <span className="text-ink-muted text-xs">
                      {b.quantity} wanted
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Your orders</h3>
            {myOrders.length === 0 ? (
              <span className="text-sm text-ink-muted py-2">You have no buy orders for this item.</span>
            ) : (
              myOrders.map((o) => (
                <div key={o._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">
                    <Monetary value={o.price} /> x{o.quantity - o.filled}
                    <span className="text-ink-faint text-xs"> · K₽{o.escrow} held</span>
                  </span>
                  <button
                    onClick={() => cancelOrder(o._id)}
                    className="px-2 py-1 rounded border border-line text-xs text-ink-muted hover:text-red-400 hover:border-red-400/50"
                  >
                    Cancel
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* listings */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">
            Listings {items?.items?.length ? `(${stats?.totalListings ?? items.items.length})` : ""}
          </h2>
          {loading ? (
            <div className="flex flex-wrap items-center gap-4">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} height={334} width={226} />
                ))}
            </div>
          ) : items && items.items && items.items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              {items.items.map((it) => (
                <Item
                  key={it._id}
                  item={it}
                  click={() => buyItem(it)}
                  remove={() => removeItem(it)}
                  loadingRemoval={loadingRemoval}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-8 text-center flex flex-col items-center gap-3">
              <span className="text-ink-muted">Nobody is selling this item right now.</span>
              <button
                onClick={() => setOpenOrderModal(true)}
                className="px-4 h-10 rounded-md border border-accent-gold/50 text-accent-gold text-sm font-semibold hover:bg-accent-gold/10"
              >
                Place a buy order instead
              </button>
            </div>
          )}
          {items?.totalPages && items.totalPages > 1 ? (
            <div className="flex justify-center">
              <Pagination totalPages={items.totalPages} currentPage={page} setPage={setPage} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ItemPage;
