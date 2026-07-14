import Skeleton from "react-loading-skeleton";
import Monetary from "../../components/Monetary";
import CompletionBar from "./components/CompletionBar";
import CollectionCard from "./components/CollectionCard";
import { CollectionsViewProps } from "./Collections.types";

const CollectionsView: React.FC<CollectionsViewProps> = ({
  summary,
  loading,
  error,
  openCase,
}) => {
  return (
    <div className="w-full flex flex-col items-center gap-8">
      {loading ? (
        <div className="w-full flex flex-wrap gap-6 justify-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              width={256}
              height={230}
              borderRadius={12}
              highlightColor="#161427"
              baseColor="#1c1a31"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-ink-muted mt-8">Could not load collections. Try again later.</p>
      ) : summary ? (
        <>
          <div className="w-full max-w-3xl bg-surface rounded-xl border border-line p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-soft font-semibold">Overall progress</span>
              <span className="text-sm text-ink-muted">
                {summary.totals.casesComplete}/{summary.totals.cases} collections complete
              </span>
            </div>
            <CompletionBar
              owned={summary.totals.slotsOwned}
              total={summary.totals.slotsTotal}
              pct={summary.totals.completionPct}
            />
            {summary.totals.duplicatesValue > 0 && (
              <div className="flex items-center justify-between text-sm pt-1 border-t border-line">
                <span className="text-ink-muted">
                  {summary.totals.duplicatesCount} duplicate items
                </span>
                <span className="text-accent-gold font-medium">
                  worth <Monetary value={summary.totals.duplicatesValue} />
                </span>
              </div>
            )}
          </div>

          <div className="w-full flex flex-wrap gap-6 justify-center">
            {summary.collections.map((c) => (
              <CollectionCard
                key={c.caseId}
                collection={c}
                onClick={() => openCase(c.caseId)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default CollectionsView;
