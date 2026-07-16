import React, { useCallback, useContext, useEffect, useState } from "react";
import MarketItem from "./MarketItem";
import { getItems, getMyOrders, cancelBuyOrder, BuyOrder } from "../../services/market/MarketService";
import SellItemModal from "./SellItemModal";
import Skeleton from "react-loading-skeleton";
import UserContext from "../../UserContext";
import Pagination from "../../components/Pagination";
import Monetary from "../../components/Monetary";
import Filters, { MarketFilters } from "./Filters";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

interface MarketRow {
  image: string;
  name: string;
  rarity: number;
  _id: string;
  uniqueId: string;
  cheapestPrice: number | null;
  totalListings: number;
  sellValue?: number;
}

interface ItemData {
  totalPages: number;
  currentPage: number;
  items: MarketRow[];
}

const Marketplace: React.FC = () => {
  const [items, setItems] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [openSellModal, setOpenSellModal] = useState<boolean>(false);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [orders, setOrders] = useState<BuyOrder[]>([]);
  const [filters, setFilters] = useState<MarketFilters>({
    name: "",
    rarity: "",
    sortBy: "recent",
    order: "desc",
    listedOnly: true,
  });

  const { isLogged } = useContext(UserContext);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getItems(page, filters);
      setItems(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchOrders = useCallback(async () => {
    if (!isLogged) {
      setOrders([]);
      return;
    }
    try {
      const mine = await getMyOrders();
      setOrders(mine.orders || []);
    } catch {
      setOrders([]);
    }
  }, [isLogged]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (refresh) {
      fetchItems();
      fetchOrders();
      setRefresh(false);
    }
  }, [refresh, fetchItems, fetchOrders]);

  // filters change the result set: go back to the first page
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const cancel = async (id: string) => {
    try {
      const res = await cancelBuyOrder(id);
      toast.success(`Order cancelled, K₽${res.refunded} refunded`);
      setRefresh(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not cancel the order");
    }
  };

  return (
    <div className="flex flex-col w-full items-center">
      <SellItemModal isOpen={openSellModal} onClose={() => setOpenSellModal(false)} setRefresh={setRefresh} />

      <div className="w-full max-w-[1312px] px-4 md:px-8 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-ink">Marketplace</h1>
            <span className="text-xs text-ink-muted">
              Buy from other players, or place a buy order and let the market come to you.
            </span>
          </div>
          {isLogged && (
            <button
              onClick={() => setOpenSellModal(true)}
              className="px-4 h-10 rounded-md bg-accent hover:bg-accent-light text-sm font-semibold text-white"
            >
              Sell an item
            </button>
          )}
        </div>

        <Filters filters={filters} setFilters={setFilters} />

        {/* your open buy orders, so escrowed KP is never invisible */}
        {isLogged && orders.length > 0 && (
          <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/[0.04] p-3 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-gold">
              Your buy orders ({orders.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {orders.map((o) => (
                <div
                  key={o._id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5"
                >
                  <img src={o.itemImage} alt="" className="w-7 h-7 object-contain" />
                  <div className="flex flex-col">
                    <Link to={`/marketplace/item/${o.item}`} className="text-xs text-ink hover:underline truncate max-w-[140px]">
                      {o.itemName}
                    </Link>
                    <span className="text-[10px] text-ink-muted">
                      <Monetary value={o.price} /> x{o.quantity - o.filled} · <Monetary value={o.escrow} /> held
                    </span>
                  </div>
                  <button
                    onClick={() => cancel(o._id)}
                    className="ml-1 text-[10px] text-ink-faint hover:text-red-400"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-wrap gap-4">
            {Array(12)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} height={260} width={200} borderRadius={12} />
              ))}
          </div>
        ) : items && items.items && items.items.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {items.items.map((item) => (
              <MarketItem key={item._id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-12 text-center text-ink-muted">
            Nothing matches those filters.
          </div>
        )}

        {items?.totalPages && items.totalPages > 1 ? (
          <div className="flex justify-center">
            <Pagination totalPages={items.totalPages} currentPage={page} setPage={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Marketplace;
