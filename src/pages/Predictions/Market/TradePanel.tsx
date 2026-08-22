import Monetary from "../../../components/Monetary";
import { toPercent } from "../../../services/predictions/PredictionService";
import { MarketViewProps } from "./Market.types";
import i18n from "../../../i18n";

type Props = Pick<
  MarketViewProps,
  | "market"
  | "isLogged"
  | "walletBalance"
  | "selected"
  | "action"
  | "setAction"
  | "sharesInput"
  | "setSharesInput"
  | "shares"
  | "quote"
  | "quoting"
  | "quoteError"
  | "submitting"
  | "submit"
  | "setMaxShares"
  | "bumpShares"
  | "heldOf"
  | "colorOf"
>;

const QUICK = [10, 50, 100];

const TradePanel: React.FC<Props> = ({
  market,
  isLogged,
  walletBalance,
  selected,
  action,
  setAction,
  sharesInput,
  setSharesInput,
  shares,
  quote,
  quoting,
  quoteError,
  submitting,
  submit,
  setMaxShares,
  bumpShares,
  heldOf,
  colorOf,
}) => {
  if (!market || !selected) return null;

  const outcome = market.outcomes.find((o) => o.key === selected);
  if (!outcome) return null;

  const held = heldOf(selected);
  const closed = market.status !== "open";
  const cannotAfford = action === "buy" && !!quote && quote.amount > walletBalance;
  const overSells = action === "sell" && shares > held;
  const blocked = closed || shares <= 0 || cannotAfford || overSells || submitting;

  return (
    <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorOf(selected) }} />
        <span className="text-ink font-semibold truncate">{outcome.label}</span>
        <span className="text-ink-muted text-sm ml-auto tabular-nums">{toPercent(outcome.priceBps)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-1 bg-surface-nav rounded p-1">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setAction(value)}
            className={`py-2 rounded text-sm transition-colors ${
              action === value
                ? value === "buy"
                  ? "bg-emerald-600 text-ink"
                  : "bg-red-600 text-ink"
                : "bg-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {i18n.t(`predictions.${value}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>{i18n.t("predictions.shares")}</span>
          {held > 0 && <span>{i18n.t("predictions.held", { count: held })}</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={sharesInput}
            onChange={(e) => setSharesInput(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="bg-surface-nav border border-line rounded px-3 py-2 text-ink outline-none focus:border-accent w-full tabular-nums"
          />
          <button
            onClick={() => bumpShares(-shares + Math.max(1, Math.floor(shares / 2)))}
            className="px-3 bg-surface-raised hover:bg-surface-hover rounded text-ink-soft text-sm"
          >
            ½
          </button>
          <button
            onClick={() => bumpShares(shares)}
            className="px-3 bg-surface-raised hover:bg-surface-hover rounded text-ink-soft text-sm"
          >
            2x
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {QUICK.map((value) => (
            <button
              key={value}
              onClick={() => setSharesInput(String(value))}
              className="text-xs px-2.5 py-1 bg-surface-nav hover:bg-surface-raised rounded text-ink-muted"
            >
              {value}
            </button>
          ))}
          {action === "sell" && held > 0 && (
            <button
              onClick={setMaxShares}
              className="text-xs px-2.5 py-1 bg-surface-nav hover:bg-surface-raised rounded text-ink-muted"
            >
              {i18n.t("predictions.max")}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">
            {action === "buy" ? i18n.t("predictions.youPay") : i18n.t("predictions.youReceive")}
          </span>
          <span className={`font-semibold tabular-nums ${quoting ? "text-ink-muted" : "text-ink"}`}>
            {quote ? <Monetary value={quote.amount} /> : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-muted">{i18n.t("predictions.averagePrice")}</span>
          <span className="text-ink-soft tabular-nums">
            {quote ? `${(quote.avgPriceBps / 100).toFixed(1)}%` : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-muted">{i18n.t("predictions.priceAfter")}</span>
          <span className="text-ink-soft tabular-nums">
            {quote ? `${toPercent(quote.startBps)}% → ${toPercent(quote.endBps)}%` : "-"}
          </span>
        </div>
        {action === "buy" && quote && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">{i18n.t("predictions.ifItHappens")}</span>
            <span className="text-emerald-400 tabular-nums">
              <Monetary value={quote.shares} />
            </span>
          </div>
        )}
      </div>

      {quoteError && <span className="text-xs text-red-400">{quoteError}</span>}

      <button
        onClick={submit}
        disabled={isLogged && blocked}
        className={`w-full py-2.5 rounded font-semibold transition-colors ${
          isLogged && blocked
            ? "bg-surface-raised text-ink-faint cursor-not-allowed"
            : action === "buy"
            ? "bg-emerald-600 hover:bg-emerald-500 text-ink"
            : "bg-red-600 hover:bg-red-500 text-ink"
        }`}
      >
        {!isLogged
          ? i18n.t("predictions.logInToTrade")
          : closed
          ? i18n.t("predictions.tradingClosed")
          : overSells
          ? i18n.t("predictions.notEnoughShares")
          : cannotAfford
          ? i18n.t("predictions.notEnoughKp")
          : submitting
          ? i18n.t("predictions.working")
          : i18n.t(`predictions.${action}`)}
      </button>

      <p className="text-[11px] text-ink-faint leading-snug">{i18n.t("predictions.panelNote")}</p>
    </div>
  );
};

export default TradePanel;
