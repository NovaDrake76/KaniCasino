import Skeleton from "react-loading-skeleton";
import { Link } from "react-router-dom";
import Monetary from "../../../components/Monetary";
import Pagination from "../../../components/Pagination";
import { OrderBookRow, OrderBookSort } from "../../../services/market/MarketService";
import { rarityColor, rarityName } from "../../../utils/rarity";
import SellIntoOrders from "./SellIntoOrders";
import { OrderBookViewProps } from "./OrderBook.types";
import i18n from "../../../i18n";

const SORTS: { key: OrderBookSort; label: string }[] = [
  { key: "gain", label: "market.sortBestGain" },
  { key: "bid", label: "market.sortHighestBid" },
  { key: "recent", label: "market.sortNewest" },
];

const Figure = ({ label, children, tone = "text-ink" }: { label: string; children: React.ReactNode; tone?: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
    <span className={`truncate text-sm font-semibold ${tone}`}>{children}</span>
  </div>
);

interface RowProps {
  row: OrderBookRow;
  signedIn: boolean;
  favorite: boolean;
  onSell: (row: OrderBookRow) => void;
}

const OrderRow = ({ row, signedIn, favorite, onSell }: RowProps) => (
  <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 md:flex-row md:items-center md:gap-4">
    <Link to={`/marketplace/item/${row.item.slug || row.item._id}`} className="flex min-w-0 items-center gap-3 md:w-60 md:shrink-0">
      <img src={row.item.image} alt="" className="h-12 w-12 shrink-0 object-contain" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink hover:underline">{row.item.name}</span>
        <span className="text-[10px]" style={{ color: rarityColor(row.item.rarity) }}>
          {rarityName(row.item.rarity)}
        </span>
      </div>
    </Link>
    <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-5">
      <Figure label={i18n.t("market.bestBuyOrder")} tone="text-accent-gold">
        <Monetary value={row.bestBid} />
      </Figure>
      <Figure label={i18n.t("market.wanted")}>
        {row.wanted}
        {row.atBest < row.wanted && <span className="ml-1 text-[10px] font-normal text-ink-muted">{i18n.t("market.atThisPrice", { n: row.atBest })}</span>}
      </Figure>
      <Figure label={i18n.t("market.youReceive")}>
        <Monetary value={row.net} />
      </Figure>
      <Figure label={i18n.t("market.houseFloor")} tone="text-ink-muted">
        <Monetary value={row.house} />
      </Figure>
      <Figure label={i18n.t("market.vsHouse")} tone={row.gain > 0 ? "text-green-400" : "text-ink-faint"}>
        {row.gain > 0 ? "+" : ""}
        <Monetary value={row.gain} />
      </Figure>
    </div>
    {signedIn && (
      <div className="flex items-center justify-between gap-3 md:w-44 md:shrink-0 md:justify-end">
        <span className="text-xs text-ink-muted">{i18n.t("market.youOwnCount", { count: row.owned || 0 })}</span>
        {!!row.owned && (
          <button
            type="button"
            onClick={() => onSell(row)}
            disabled={favorite}
            title={favorite ? i18n.t("common.favoriteLocked") : undefined}
            className="h-9 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i18n.t("market.sellNow")}
          </button>
        )}
      </div>
    )}
  </div>
);

const OrderBookView: React.FC<OrderBookViewProps> = ({
  loading,
  rows,
  totalPages,
  page,
  setPage,
  sort,
  setSort,
  isLogged,
  isFavorite,
  startSell,
  selling,
  closeSell,
  quantityText,
  setQuantityText,
  confirmSell,
  busy,
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="max-w-xl text-xs text-ink-muted">{i18n.t("market.ordersIntro")}</span>
      <div className="flex gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            className={`h-8 rounded-md px-3 text-xs font-semibold ${sort === s.key ? "bg-accent text-white" : "bg-surface-nav text-ink-muted hover:text-ink"}`}
          >
            {i18n.t(s.label)}
          </button>
        ))}
      </div>
    </div>

    {loading ? (
      <div className="flex flex-col gap-2">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} height={74} borderRadius={8} />
          ))}
      </div>
    ) : rows.length === 0 ? (
      <div className="rounded-xl border border-line bg-surface p-12 text-center text-ink-muted">{i18n.t("market.noOpenOrders")}</div>
    ) : (
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <OrderRow key={String(row.item._id)} row={row} signedIn={isLogged} favorite={isFavorite(row)} onSell={startSell} />
        ))}
      </div>
    )}

    {totalPages > 1 && (
      <div className="flex justify-center">
        <Pagination totalPages={totalPages} currentPage={page} setPage={setPage} />
      </div>
    )}

    {selling && (
      <SellIntoOrders
        row={selling}
        quantityText={quantityText}
        setQuantityText={setQuantityText}
        busy={busy}
        onConfirm={confirmSell}
        onClose={closeSell}
      />
    )}
  </div>
);

export default OrderBookView;
