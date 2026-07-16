import Skeleton from "react-loading-skeleton";
import MissionCard from "./components/MissionCard";
import { MissionsData } from "../../services/missions/MissionService";

interface Props {
  data: MissionsData | null;
  loading: boolean;
  error: boolean;
  claimingKey: string | null;
  claim: (key: string) => void;
  visit: (key: string, url: string) => void;
  isOwner: boolean;
  caseImage?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Getting started",
  games: "Games",
  collection: "Collection",
  community: "Community",
  endgame: "Endgame",
};
const CATEGORY_ORDER = ["onboarding", "games", "collection", "community", "endgame"];

const MissionsView: React.FC<Props> = ({
  data,
  loading,
  error,
  claimingKey,
  claim,
  visit,
  isOwner,
  caseImage,
}) => {
  if (!isOwner) {
    return <p className="text-ink-muted py-8 text-center">Missions are private.</p>;
  }
  if (loading) {
    return (
      <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} height={92} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />
          ))}
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-ink-muted py-8 text-center">Could not load missions.</p>;
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: data.missions.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-full max-w-[1100px] flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-ink-muted">
          <span className="text-ink font-semibold">{data.totals.claimed}</span> of {data.totals.total} missions claimed
        </span>
        {data.totals.claimable > 0 && (
          <span className="px-3 py-1.5 rounded-lg bg-accent-gold/15 text-accent-gold text-sm font-semibold animate-pulse">
            {data.totals.claimable} ready to claim
          </span>
        )}
      </div>

      {grouped.map(({ cat, items }) => (
        <div key={cat} className="flex flex-col gap-3">
          <h3
            className={`text-sm font-semibold uppercase tracking-wide ${
              cat === "endgame" ? "text-accent-gold" : "text-ink-muted"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((m) => (
              <MissionCard
                key={m.key}
                mission={m}
                claiming={claimingKey === m.key}
                claim={claim}
                visit={visit}
                caseImage={caseImage}
                endgame={cat === "endgame"}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MissionsView;
