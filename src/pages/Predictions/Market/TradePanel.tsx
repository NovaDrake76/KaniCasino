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
  | "select"
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
  | "maxShares"
  | "setSharesTo"
  | "bumpShares"
  | "heldOf"
  | "colorOf"
>;

const QUICK = [10, 50, 100];

// the quote is a round trip, so the numbers it fills in are blank for a moment. a bar that
// keeps the row's height is the difference between "loading" and "zero".
const Pending = ({ w }: { w: string }) => (
  <span className={`inline-block h-3 ${w} rounded bg-surface-raised animate-pulse align-middle`} />
);

const TradePanel: React.FC<Props> = ({
  market,
  isLogged,
  walletBalance,
  selected,
  select,
  action,
  setAction,
  sharesInput,
  setSharesInput,
  shares,
  maxShares,
  quote,
  quoting,
  quoteError,
  submitting,
  submit,
  setSharesTo,
  bumpShares,
  heldOf,
  colorOf,
}) => {
  if (!market || !selected) return null;

  const outcome = market.outcomes.find((o) => o.key === selected);
  if (!outcome) return null;

  const held = heldOf(selected);
  // a yes-or-no market has no outcome list above it, so the two prices are the picker
  const binary = market.outcomes.length === 2;
  const closed = market.status !== "open";
  const cannotAfford = action === "buy" && !!quote && quote.amount > walletBalance;
  const overSells = action === "sell" && shares > held;
  // a quote in flight means the panel is showing a number that is about to change, so the
  // button is not offered until it settles
  const blocked = closed || shares <= 0 || cannotAfford || overSells || submitting || quoting;

  return (
    <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-4">
      {binary ? (
        <div className="grid grid-cols-2 gap-2">
          {market.outcomes.map((option) => (
            <button
              key={option.key}
              onClick={() => select(option.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 rounded transition-colors ${
                selected === option.key
                  ? "bg-accent text-ink"
                  : "bg-surface-nav text-ink-soft hover:bg-surface-raised"
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs tabular-nums opacity-80">{toPercent(option.priceBps)}%</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorOf(selected) }} />
          <span className="text-ink font-semibold truncate">{outcome.label}</span>
          <span className="text-ink-muted text-sm ml-auto tabular-nums">{toPercent(outcome.priceBps)}%</span>
        </div>
      )}

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
            max={maxShares ?? undefined}
            className="bg-surface-nav border border-line rounded px-3 py-2 text-ink outline-none focus:border-accent w-full tabular-nums"
          />
          <button
            onClick={() => setSharesTo(Math.max(1, Math.floor(shares / 2)))}
            className="px-3 bg-surface-raised hover:bg-surface-hover rounded text-ink-soft text-sm"
          >
            ½
          </button>
          <button
            onClick={() => bumpShares(shares)}
            disabled={maxShares !== null && shares >= maxShares}
            className="px-3 bg-surface-raised hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-surface-raised rounded text-ink-soft text-sm"
          >
            2x
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {action === "sell" ? (
            <>
              <button
                onClick={() => setSharesTo(Math.max(1, Math.floor(held / 2)))}
                disabled={held <= 0}
                className="text-xs px-2.5 py-1 bg-surface-nav hover:bg-surface-raised disabled:opacity-40 rounded text-ink-muted"
              >
                {i18n.t("predictions.half")}
              </button>
              <button
                onClick={() => setSharesTo(held)}
                disabled={held <= 0}
                className="text-xs px-2.5 py-1 bg-surface-nav hover:bg-surface-raised disabled:opacity-40 rounded text-ink-muted"
              >
                {i18n.t("predictions.sellAll", { count: held })}
              </button>
            </>
          ) : (
            QUICK.map((value) => (
              <button
                key={value}
                onClick={() => setSharesTo(value)}
                className="text-xs px-2.5 py-1 bg-surface-nav hover:bg-surface-raised rounded text-ink-muted"
              >
                {value}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">
            {action === "buy" ? i18n.t("predictions.youPay") : i18n.t("predictions.youReceive")}
          </span>
          <span className="font-semibold tabular-nums text-ink">
            {quoting ? <Pending w="w-16" /> : quote ? <Monetary value={quote.amount} /> : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-muted">{i18n.t("predictions.averagePrice")}</span>
          <span className="text-ink-soft tabular-nums">
            {quoting ? <Pending w="w-10" /> : quote ? `${(quote.avgPriceBps / 100).toFixed(1)}%` : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-muted">{i18n.t("predictions.priceAfter")}</span>
          <span className="text-ink-soft tabular-nums">
            {quoting ? <Pending w="w-20" /> : quote ? `${toPercent(quote.startBps)}% → ${toPercent(quote.endBps)}%` : "-"}
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
          : quoting
          ? i18n.t("predictions.pricing")
          : i18n.t(`predictions.${action}`)}
      </button>

      <p className="text-[11px] text-ink-faint leading-snug">{i18n.t("predictions.panelNote")}</p>
    </div>
  );
};

export default TradePanel;
