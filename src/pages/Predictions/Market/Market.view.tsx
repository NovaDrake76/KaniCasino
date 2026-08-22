import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Monetary from "../../../components/Monetary";
import OutcomeChart from "../../../components/OutcomeChart";
import { StatusChip } from "../MarketStatus";
import { endsInLabel } from "../marketTime";
import TradePanel from "./TradePanel";
import TradeFeed from "./TradeFeed";
import { MarketViewProps } from "./Market.types";
import { toPercent } from "../../../services/predictions/PredictionService";
import i18n from "../../../i18n";

const MarketView: React.FC<MarketViewProps> = (props) => {
  const { market, loading, notFound, series, loadingSeries, trades, selected, select, colorOf, heldOf, avgOf } = props;

  if (notFound) {
    return (
      <div className="w-full flex flex-col items-center py-24 gap-4">
        <span className="text-ink text-lg">{i18n.t("predictions.marketNotFound")}</span>
        <Link to="/predictions" className="text-accent-light hover:underline text-sm">
          {i18n.t("predictions.backToMarkets")}
        </Link>
      </div>
    );
  }

  if (loading || !market) {
    return (
      <div className="w-full max-w-[1100px] mx-auto py-8 px-4 flex flex-col gap-4">
        <Skeleton height={90} borderRadius={8} />
        <Skeleton height={260} borderRadius={8} />
      </div>
    );
  }

  const ends = endsInLabel(market.endsAt);
  const winner = market.outcomes.find((o) => o.key === market.resolvedOutcome);

  return (
    <div className="w-full max-w-[1100px] mx-auto py-8 px-4 flex flex-col gap-5">
      <Link to="/predictions" className="text-ink-muted hover:text-ink text-sm w-fit">
        {i18n.t("predictions.backToMarkets")}
      </Link>

      <div className="flex items-start gap-4">
        {market.image && (
          <img src={market.image} alt="" className="w-16 h-16 rounded object-cover bg-surface-nav flex-shrink-0" />
        )}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={market.status} />
            <span className="text-[11px] text-ink-faint uppercase tracking-wide">{market.category}</span>
            {ends && <span className="text-[11px] text-ink-muted">{ends}</span>}
          </div>
          <h1 className="text-ink text-2xl font-semibold leading-tight">{market.title}</h1>
          {market.description && <p className="text-ink-soft text-sm">{market.description}</p>}
          <div className="flex gap-4 text-xs text-ink-muted">
            <span>
              <Monetary value={market.volume} /> {i18n.t("predictions.traded")}
            </span>
            <span>{i18n.t("predictions.tradersCount", { count: market.traders })}</span>
          </div>
        </div>
      </div>

      {market.status === "resolved" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex flex-col gap-1">
          <span className="text-emerald-400 text-sm font-semibold">
            {i18n.t("predictions.resolvedTo", { outcome: winner ? winner.label : market.resolvedOutcome })}
          </span>
          {market.resolutionNote && <span className="text-ink-soft text-xs">{market.resolutionNote}</span>}
        </div>
      )}

      {market.status === "void" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex flex-col gap-1">
          <span className="text-red-400 text-sm font-semibold">{i18n.t("predictions.marketCancelled")}</span>
          {market.resolutionNote && <span className="text-ink-soft text-xs">{market.resolutionNote}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <OutcomeChart series={series} loading={loadingSeries} />

          <div className="bg-surface border border-line rounded-lg divide-y divide-line">
            {market.outcomes.map((outcome) => {
              const held = heldOf(outcome.key);
              const isSelected = selected === outcome.key;
              const won = market.resolvedOutcome === outcome.key;
              return (
                <button
                  key={outcome.key}
                  onClick={() => select(outcome.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-surface-raised" : "hover:bg-surface-raised/50"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorOf(outcome.key) }}
                  />
                  {outcome.image && (
                    <img src={outcome.image} alt="" className="w-8 h-8 rounded object-cover bg-surface-nav" />
                  )}
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <span className="text-ink text-sm truncate">{outcome.label}</span>
                    {held > 0 && (
                      <span className="text-[11px] text-accent-gold">
                        {i18n.t("predictions.heldAt", { count: held, price: toPercent(avgOf(outcome.key)) })}
                      </span>
                    )}
                  </div>
                  {won && (
                    <span className="text-[11px] text-emerald-400 uppercase tracking-wide ml-auto">
                      {i18n.t("predictions.won")}
                    </span>
                  )}
                  <span className={`text-ink font-semibold tabular-nums ${won ? "" : "ml-auto"}`}>
                    {toPercent(outcome.priceBps)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <TradePanel {...props} />
          <TradeFeed trades={trades} colorOf={colorOf} />
        </div>
      </div>
    </div>
  );
};

export default MarketView;
