import React, { useContext, useEffect, useRef, useState } from "react";
import { sellItem, getItemHistory, ItemHistory } from "../../services/market/MarketService";
import { getInventory } from "../../services/users/UserServices";
import UserContext from "../../UserContext";
import Item from "../../components/Item";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import PriceChart from "../../components/PriceChart";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Pagination from "../../components/Pagination";
import Filters from "../../components/InventoryFilters";
import Modal from "../../components/Modal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  setRefresh?: (value: boolean) => void;
}

interface InventoryItem {
  _id: string;
  name: string;
  image: string;
  rarity: string;
  uniqueId: string;
}

interface Inventory {
  totalPages: number;
  currentPage: number;
  items: InventoryItem[];
}

// one price reference (what the house pays, what others ask, what it actually sells for)
const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; accent?: string }> = ({
  label,
  value,
  hint,
  accent,
}) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
    <span className={`text-sm font-semibold truncate ${accent || "text-ink"}`}>{value}</span>
    {hint && <span className="text-[10px] text-ink-faint truncate">{hint}</span>}
  </div>
);

const SellItemModal: React.FC<Props> = ({ isOpen, onClose, setRefresh }) => {
  const [selectedItem, setSelectedItem] = useState<any>();
  const [price, setPrice] = useState<number | undefined>();
  const [inventory, setInventory] = useState<Inventory>();
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const [history, setHistory] = useState<ItemHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [filters, setFilters] = useState({ name: "", rarity: "", sortBy: "", order: "asc" });
  const delayDebounceFn = useRef<NodeJS.Timeout | null>(null);

  const { userData } = useContext(UserContext);

  const CloseModal = () => {
    setSelectedItem(null);
    setPrice(0);
    setInvItems([]);
    setHistory(null);
    setPage(1);
    onClose();
  };

  // whenever an item is picked, pull what it actually trades for
  useEffect(() => {
    if (!selectedItem?._id) {
      setHistory(null);
      return;
    }
    let active = true;
    setLoadingHistory(true);
    setHistory(null);
    getItemHistory(selectedItem._id, "month")
      .then((h) => {
        if (!active) return;
        setHistory(h);
        // pre-fill with the most defensible ask we can suggest
        const suggested = h.stats.median7d ?? h.stats.median30d ?? h.stats.lowestListing ?? h.stats.floor;
        if (suggested) setPrice(suggested);
      })
      .catch(() => {
        // guidance is a nice-to-have; listing still works without it
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [selectedItem?._id]);

  const handleSubmit = async () => {
    setLoadingButton(true);
    if (!price || price < 1 || price > 1000000) {
      setLoadingButton(false);
      return toast.error("Price must be between 1 and 1.000.000", {});
    }
    try {
      const res = await sellItem(selectedItem.uniqueId, price);
      setRefresh && setRefresh(true);
      if (res?.soldInstantly) {
        toast.success(`Sold instantly to a buy order for K₽${res.soldFor}! You received K₽${res.received}`);
      } else {
        toast.success("Item listed for sale!", {});
      }
      CloseModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not list the item");
    }
    setLoadingButton(false);
  };

  const getInventoryInfo = async (newPage?: number) => {
    try {
      const response = await getInventory(userData.id, page, filters);
      setInventory(response);
      newPage
        ? setInvItems((prev) => [...prev, ...response.items])
        : setInvItems(response.items);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(delayDebounceFn.current as NodeJS.Timeout);
      getInventoryInfo();
    }
  };

  useEffect(() => {
    if (invItems?.length > 0) {
      delayDebounceFn.current = setTimeout(() => {
        getInventoryInfo();
      }, 1000);
      return () => {
        if (delayDebounceFn.current) clearTimeout(delayDebounceFn.current);
      };
    }
  }, [filters]);

  useEffect(() => {
    if (isOpen) {
      setInvItems([]);
      getInventoryInfo(page);
    }
  }, [isOpen, page]);

  if (!isOpen) return null;

  const stats = history?.stats;
  const feeRate = stats?.feeRate ?? 0.05;
  const p = price || 0;
  const fee = Math.floor(p * feeRate);
  const receive = Math.max(0, p - fee);
  const crossesBid = !!(stats?.bestBid && p > 0 && p <= stats.bestBid);

  return (
    <Modal open={isOpen} setOpen={onClose} width="min(980px, 95vw)">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Sell an item</h2>

        <Filters filters={filters} setFilters={setFilters} onKeyPress={handleEnterPress} />

        <div className="max-h-[28vh] overflow-y-auto overflow-x-hidden -mx-1 px-1">
          {loadingInventory ? (
            <div className="flex flex-wrap justify-center gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} width={128} height={150} />
              ))}
            </div>
          ) : invItems.length === 0 ? (
            <div className="text-center text-ink-muted py-12">No items to sell.</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {invItems.map((item, index) => {
                const isSelected = selectedItem && selectedItem.uniqueId === item.uniqueId;
                return (
                  <div
                    key={item._id + index}
                    onClick={() => setSelectedItem(item)}
                    className={`rounded-lg cursor-pointer transition-all p-1 border-2 ${
                      isSelected ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface"
                    }`}
                  >
                    <Item item={item} size="small" />
                  </div>
                );
              })}
            </div>
          )}
          {inventory && inventory.totalPages > 1 && (
            <div className="w-full flex justify-center mt-3">
              <Pagination
                totalPages={inventory.totalPages}
                currentPage={inventory.currentPage}
                setPage={setPage}
              />
            </div>
          )}
        </div>

        {/* price guidance: the whole point is that you never have to guess */}
        {selectedItem && (
          <div className="rounded-lg border border-line bg-surface p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="Median (7d)"
                value={stats?.median7d ? <Monetary value={stats.median7d} /> : "No sales"}
                hint={stats?.volume7d ? `${stats.volume7d} sold this week` : "nothing sold recently"}
                accent="text-ink"
              />
              <Stat
                label="Lowest listing"
                value={stats?.lowestListing ? <Monetary value={stats.lowestListing} /> : "None listed"}
                hint={stats?.totalListings ? `${stats.totalListings} on sale` : "you'd be the only one"}
                accent="text-accent"
              />
              <Stat
                label="Best buy order"
                value={stats?.bestBid ? <Monetary value={stats.bestBid} /> : "No bids"}
                hint={stats?.bestBid ? "sells instantly at or below" : undefined}
                accent="text-accent-gold"
              />
              <Stat
                label="House floor"
                value={stats ? <Monetary value={stats.floor} /> : "-"}
                hint="instant sell, no wait"
                accent="text-ink-muted"
              />
            </div>

            <PriceChart points={history?.points || []} floor={stats?.floor} height={120} loading={loadingHistory} />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-ink-muted mr-1">Quick price:</span>
              {stats?.median7d ? (
                <button
                  onClick={() => setPrice(stats.median7d as number)}
                  className="px-2 py-1 rounded border border-line text-xs hover:bg-surface-raised"
                >
                  Median
                </button>
              ) : null}
              {stats?.lowestListing ? (
                <>
                  <button
                    onClick={() => setPrice(stats.lowestListing as number)}
                    className="px-2 py-1 rounded border border-line text-xs hover:bg-surface-raised"
                  >
                    Match lowest
                  </button>
                  <button
                    onClick={() => setPrice(Math.max(1, (stats.lowestListing as number) - 1))}
                    className="px-2 py-1 rounded border border-line text-xs hover:bg-surface-raised"
                  >
                    Undercut by 1
                  </button>
                </>
              ) : null}
              {stats?.bestBid ? (
                <button
                  onClick={() => setPrice(stats.bestBid as number)}
                  className="px-2 py-1 rounded border border-accent-gold/50 text-accent-gold text-xs hover:bg-accent-gold/10"
                >
                  Sell to bid now
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line pt-4 bg-surface-nav">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectedItem ? (
                <>
                  <img src={selectedItem.image} alt={selectedItem.name} className="w-12 h-12 object-contain shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold truncate">{selectedItem.name}</span>
                    {p > 0 && (
                      <span className="text-xs text-ink-muted">
                        You receive <span className="text-accent-gold font-semibold"><Monetary value={receive} /></span>
                        {" "}· buyer pays <Monetary value={p} /> ({Math.round(feeRate * 100)}% fee <Monetary value={fee} />)
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-ink-muted text-sm">Pick an item above to sell it.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <span className="absolute inset-y-0 left-3 flex items-center text-ink-muted text-sm pointer-events-none">
                  K₽
                </span>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  placeholder="Price"
                  value={price ?? ""}
                  onKeyDown={(event) => {
                    if (
                      !/[0-9]/.test(event.key) &&
                      !["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete"].includes(event.key)
                    ) {
                      event.preventDefault();
                    }
                  }}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                  className="w-full sm:w-36 bg-surface-nav border border-line focus:border-accent outline-none rounded pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={CloseModal}
                className="px-4 py-2 rounded bg-surface-raised hover:bg-red-700 text-sm font-semibold"
              >
                Close
              </button>
              <div className="w-32 shrink-0">
                <MainButton
                  text={crossesBid ? "Sell now" : "List item"}
                  onClick={handleSubmit}
                  loading={loadingButton}
                  disabled={!selectedItem || !price || loadingButton}
                  type={crossesBid ? "success" : "button"}
                />
              </div>
            </div>
          </div>
          {crossesBid && (
            <span className="text-xs text-accent-gold">
              A buy order is bidding <Monetary value={stats?.bestBid || 0} /> — this sells instantly at that price.
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SellItemModal;
