import { Link } from "react-router-dom";
import Monetary from "../../../components/Monetary";
import CompletionBar from "./CompletionBar";
import { CollectionSummaryItem } from "../../../services/collections/CollectionService";

interface Props {
  collection: CollectionSummaryItem;
  to: string;
}

const CollectionCard: React.FC<Props> = ({ collection, to }) => {
  const c = collection;
  return (
    <Link
      to={to}
      className={`w-64 flex flex-col rounded-xl bg-surface border p-4 gap-3 transition-all hover:-translate-y-1 hover:bg-surface-raised ${
        c.complete ? "border-accent-gold" : "border-line"
      }`}
    >
      <div className="h-28 flex items-center justify-center overflow-hidden">
        <img src={c.image} alt={c.title} className="max-h-full object-contain" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink truncate">{c.title}</span>
        {c.complete && (
          <span className="text-xs font-bold text-accent-gold shrink-0">COMPLETE</span>
        )}
      </div>

      <CompletionBar owned={c.slotsOwned} total={c.slotsTotal} pct={c.completionPct} />

      <div className="flex items-center justify-between text-xs pt-1 border-t border-line">
        <span className="text-ink-muted">
          {c.duplicatesCount > 0 ? `${c.duplicatesCount} duplicates` : "No duplicates"}
        </span>
        {c.duplicatesValue > 0 && (
          <span className="text-accent-gold font-medium">
            <Monetary value={c.duplicatesValue} />
          </span>
        )}
      </div>
    </Link>
  );
};

export default CollectionCard;
