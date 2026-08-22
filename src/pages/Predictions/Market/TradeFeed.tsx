import { Link } from "react-router-dom";
import Avatar from "../../../components/Avatar";
import Monetary from "../../../components/Monetary";
import { MarketTrade } from "../../../services/predictions/PredictionService";
import { agoLabel } from "../marketTime";
import i18n from "../../../i18n";

interface Props {
  trades: MarketTrade[];
  colorOf: (key: string) => string;
}

const TradeFeed: React.FC<Props> = ({ trades, colorOf }) => (
  <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
    <span className="text-ink font-semibold text-sm">{i18n.t("predictions.recentTrades")}</span>

    {trades.length === 0 ? (
      <span className="text-ink-muted text-sm py-4 text-center">{i18n.t("predictions.noTradesYet")}</span>
    ) : (
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
        {trades.map((trade) => (
          <div key={trade._id} className="flex items-center gap-2.5 text-xs">
            <Avatar image={trade.user.profilePicture} id={trade.user._id} size="small" level={trade.user.level} />
            <div className="flex flex-col min-w-0 gap-0.5">
              <Link to={`/profile/${trade.user._id}`} className="text-ink-soft hover:text-ink truncate">
                {trade.user.username}
              </Link>
              <span className="text-ink-muted flex items-center gap-1">
                <span className={trade.action === "buy" ? "text-emerald-400" : "text-red-400"}>
                  {i18n.t(`predictions.${trade.action}`)}
                </span>
                <span>{trade.shares}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorOf(trade.outcomeKey) }} />
                <span className="truncate">{trade.outcomeLabel}</span>
              </span>
            </div>
            <div className="flex flex-col items-end ml-auto gap-0.5 flex-shrink-0">
              <span className="text-ink tabular-nums">
                <Monetary value={trade.amount} />
              </span>
              <span className="text-ink-faint">{agoLabel(trade.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default TradeFeed;
