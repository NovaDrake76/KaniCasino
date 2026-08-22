import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Monetary from "../../components/Monetary";
import { getMyPositions, HeldPosition, toPercent } from "../../services/predictions/PredictionService";
import i18n from "../../i18n";

const PredictionsPanel: React.FC = () => {
  const [positions, setPositions] = useState<HeldPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyPositions()
      .then((rows) => active && setPositions(rows))
      .catch(() => active && setPositions([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-[900px] mx-auto px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={64} borderRadius={8} />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="w-full max-w-[900px] mx-auto px-4 py-16 text-center text-ink-muted text-sm">
        {i18n.t("predictions.noPositions")}{" "}
        <Link to="/predictions" className="text-accent-light hover:underline">
          {i18n.t("predictions.title")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-[900px] mx-auto px-4">
      {positions.map((position) => {
        const won = position.settled && position.payout > 0;
        return (
          <Link
            key={position._id}
            to={`/predictions/${position.market.slug}`}
            className="flex items-center gap-3 bg-surface hover:bg-surface-raised border border-line rounded-lg px-4 py-3 transition-colors"
          >
            {position.market.image && (
              <img src={position.market.image} alt="" className="w-10 h-10 rounded object-cover object-top bg-surface-nav flex-shrink-0" />
            )}
            <div className="flex flex-col min-w-0 gap-0.5">
              <span className="text-ink text-sm truncate">{position.market.title}</span>
              <span className="text-xs text-ink-muted">
                {position.shares} x {position.outcomeLabel} · {i18n.t("predictions.avgCost")}{" "}
                {toPercent(position.avgPriceBps)}%
              </span>
            </div>
            <div className="flex flex-col items-end ml-auto gap-0.5 flex-shrink-0">
              {position.settled ? (
                <span className={`text-sm tabular-nums ${won ? "text-emerald-400" : "text-ink-muted"}`}>
                  <Monetary value={position.payout} />
                </span>
              ) : (
                <span className="text-sm text-ink tabular-nums">
                  <Monetary value={position.value} />
                </span>
              )}
              <span className="text-[11px] text-ink-faint">
                {position.settled ? i18n.t("predictions.payout") : i18n.t("predictions.value")}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default PredictionsPanel;
