import { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../components/Modal";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import { placeBuyOrder, MarketStats } from "../../services/market/MarketService";
import i18n from "../../i18n";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: { _id: string; name: string; image: string };
  stats?: MarketStats | null;
  onPlaced?: () => void;
}

// place a standing offer to buy. funds are escrowed up front, so the order can always
// pay when it matches; anything already listed at or below the bid fills immediately.
const PlaceBuyOrderModal: React.FC<Props> = ({ isOpen, onClose, item, stats, onPlaced }) => {
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const total = (price || 0) * (quantity || 1);
  const fillsNow = !!(stats?.lowestListing && price >= stats.lowestListing);

  const submit = async () => {
    if (!price || price < 1 || price > 1000000) return toast.error(i18n.t("market.priceMustBeBetween"));
    if (!quantity || quantity < 1 || quantity > 20) return toast.error(i18n.t("market.quantityMustBeBetween"));
    setLoading(true);
    try {
      const res = await placeBuyOrder(item._id, price, quantity);
      if (res.filled > 0 && res.order) {
        toast.success(`Bought ${res.filled} now, ${res.order.quantity} left as a buy order`);
      } else if (res.filled > 0) {
        toast.success(`Bought ${res.filled} instantly`);
      } else {
        toast.success(i18n.t("market.buyOrderPlaced"));
      }
      if (res.message) toast.info(res.message);
      onPlaced && onPlaced();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not place the order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} setOpen={onClose} width="min(460px, 95vw)">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src={item.image} alt={item.name} className="w-12 h-12 object-contain" />
          <div className="flex flex-col">
            <h3 className="font-semibold text-ink">{i18n.t("market.placeABuyOrder2")}</h3>
            <span className="text-xs text-ink-muted">{item.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded border border-line bg-surface p-2">
            <div className="text-ink-muted">{i18n.t("market.lowestListing")}</div>
            <div className="text-accent font-semibold">
              {stats?.lowestListing ? <Monetary value={stats.lowestListing} /> : "None"}
            </div>
          </div>
          <div className="rounded border border-line bg-surface p-2">
            <div className="text-ink-muted">{i18n.t("market.median7d")}</div>
            <div className="text-ink font-semibold">
              {stats?.median7d ? <Monetary value={stats.median7d} /> : "No sales"}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-ink-muted">{i18n.t("market.priceEach")}</span>
            <input
              type="number"
              min={1}
              max={1000000}
              value={price || ""}
              onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
              className="bg-surface-nav border border-line focus:border-accent outline-none rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 w-24">
            <span className="text-xs text-ink-muted">{i18n.t("market.quantity")}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="bg-surface-nav border border-line focus:border-accent outline-none rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="rounded border border-line bg-surface p-3 text-xs flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-ink-muted">{i18n.t("market.chargedNowUpTo")}</span>
            <span className="text-ink font-semibold">
              <Monetary value={total} />
            </span>
          </div>
          {fillsNow ? (
            <span className="text-accent-gold">
              Anything already listed at or below your bid is bought immediately (spent, not refundable).
              Only the unfilled rest is held as escrow and refunded if you cancel.
            </span>
          ) : (
            <span className="text-ink-faint">
              Held as escrow and refunded in full if you cancel. This guarantees your order can pay when it matches.
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-surface-raised text-sm font-semibold">
            Cancel
          </button>
          <div className="flex-1">
            <MainButton
              text={i18n.t("market.placeBuyOrder")}
              onClick={submit}
              loading={loading}
              disabled={loading || !price}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PlaceBuyOrderModal;
