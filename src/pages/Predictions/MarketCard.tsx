import Monetary from "../../components/Monetary";
import { OUTCOME_COLORS } from "../../components/outcomeColors";
import { Market, toPercent, isBinary, yesOutcome } from "../../services/predictions/PredictionService";
import { StatusChip, EndsIn } from "./MarketStatus";
import i18n from "../../i18n";

interface Props {
  market: Market;
  onClick: () => void;
}

const SHOWN = 3;

// market art is anchored object-top everywhere it is drawn: it is usually a character, and a
// square crop out of the middle of a portrait takes the face off
const MarketCard: React.FC<Props> = ({ market, onClick }) => {
  const held = market.outcomes.reduce((total, o) => total + o.shares, 0);
  const ranked = market.outcomes.map((o, i) => ({ ...o, color: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }));
  const shown = [...ranked].sort((a, b) => b.priceBps - a.priceBps).slice(0, SHOWN);
  const hidden = market.outcomes.length - shown.length;
  // a yes-or-no card says the one number, the way the market itself is phrased
  const yes = isBinary(market) ? yesOutcome(market) : null;

  return (
    <button
      onClick={onClick}
      className="text-left flex flex-col gap-3 bg-surface hover:bg-surface-raised transition-colors rounded-lg p-4 border border-line w-full"
    >
      <div className="flex items-start gap-3">
        {market.image && (
          <img src={market.image} alt="" className="w-12 h-12 rounded object-cover object-top bg-surface-nav flex-shrink-0" />
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={market.status} />
            <span className="text-[11px] text-ink-faint uppercase tracking-wide">{market.category}</span>
          </div>
          <span className="text-ink font-semibold leading-snug line-clamp-2">{market.title}</span>
        </div>
      </div>

      {yes ? (
        <div className="flex items-center gap-3">
          <div className="h-1.5 rounded-full bg-surface-nav overflow-hidden flex-1">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${toPercent(yes.priceBps)}%` }}
            />
          </div>
          <span className="text-ink text-xl font-semibold tabular-nums">
            {i18n.t("predictions.chance", { percent: toPercent(yes.priceBps) })}
          </span>
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        {shown.map((outcome) => (
          <div key={outcome.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-ink-soft truncate">{outcome.label}</span>
              <span className="text-ink font-semibold tabular-nums">{toPercent(outcome.priceBps)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-nav overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${toPercent(outcome.priceBps)}%`, backgroundColor: outcome.color }}
              />
            </div>
          </div>
        ))}
        {hidden > 0 && (
          <span className="text-[11px] text-ink-faint">{i18n.t("predictions.moreOutcomes", { count: hidden })}</span>
        )}
      </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-ink-muted mt-auto pt-1">
        <span>
          <Monetary value={market.volume} /> {i18n.t("predictions.traded")}
        </span>
        {held > 0 ? (
          <span className="text-accent-gold">{i18n.t("predictions.youHold", { count: held })}</span>
        ) : (
          <EndsIn endsAt={market.endsAt} />
        )}
      </div>
    </button>
  );
};

export default MarketCard;
