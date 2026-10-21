import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import { OrderBookRow } from "../../../services/market/MarketService";
import { digitsOnly, clampDigits } from "../../../utils/digits";
import { rarityColor, rarityName } from "../../../utils/rarity";
import i18n from "../../../i18n";

interface Props {
  row: OrderBookRow;
  quantityText: string;
  setQuantityText: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const Figure = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
    <span className={`truncate text-sm font-semibold ${tone}`}>
      <Monetary value={value} />
    </span>
  </div>
);

const SellIntoOrders: React.FC<Props> = ({ row, quantityText, setQuantityText, busy, onConfirm, onClose }) => {
  const owned = row.owned || 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-label={i18n.t("market.sellToBuyOrder")} className="flex max-h-[90vh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto bg-[#17132B] p-5 md:p-6">
        <h2 className="m-0 text-lg font-semibold">{i18n.t("market.sellToBuyOrder")}</h2>
        <div className="flex items-center gap-3">
          <img src={row.item.image} alt="" className="h-16 w-16 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-ink">{row.item.name}</span>
            <span className="text-xs" style={{ color: rarityColor(row.item.rarity) }}>
              {rarityName(row.item.rarity)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 bg-surface p-3">
          <Figure label={i18n.t("market.bestBuyOrder")} value={row.bestBid} tone="text-accent-gold" />
          <Figure label={i18n.t("market.youReceiveEach")} value={row.net} tone="text-ink" />
          <Figure label={i18n.t("market.houseFloor")} value={row.house} tone="text-ink-muted" />
        </div>
        {owned > 1 && (
          <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
            {i18n.t("market.quantity")}
            <input
              type="text"
              inputMode="numeric"
              value={quantityText}
              onChange={(e) => setQuantityText(digitsOnly(e.target.value, 4))}
              onBlur={() => setQuantityText(String(clampDigits(quantityText, 1, owned, 1)))}
              title={i18n.t("market.youOwnCount", { count: owned })}
              className="w-24 border border-line bg-surface-nav px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        )}
        <p className="m-0 text-xs text-ink-muted">{i18n.t("market.onlyIntoOrders")}</p>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md bg-surface-raised px-4 py-2 text-sm font-semibold hover:bg-surface-hover">
            {i18n.t("market.close")}
          </button>
          <div className="w-40">
            <MainButton text={i18n.t("market.sellNow")} onClick={onConfirm} loading={busy} disabled={busy} type="success" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellIntoOrders;
