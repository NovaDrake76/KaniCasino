import { Link } from "react-router-dom";
import { FanRank } from "../../services/fandom/FandomService";
import { rarityColor } from "../../utils/rarity";
import i18n from "../../i18n";

interface FanStandingProps {
  fanRank?: FanRank | null;
  collectionRank?: { distinct: number; total: number; rank: number } | null;
}

// the standing under the pinned character: what board they are on, where they sit, and
// how much of the roster they have collected overall
const FanStanding: React.FC<FanStandingProps> = ({ fanRank, collectionRank }) => {
  if (!fanRank && !collectionRank) return null;

  return (
    <div className="notched mt-3 flex min-w-[350px] flex-col gap-3 bg-[#212031] px-4 py-3.5">
      {fanRank && (
        <Link
          to={`/fandom/${encodeURIComponent(fanRank.name)}`}
          className="flex items-center gap-3 transition-all hover:opacity-80"
        >
          <span className="relative shrink-0">
            <span
              className="notched-sm block h-10 w-10 bg-[#19172d] bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${fanRank.image})`,
                borderBottom: `3px solid ${rarityColor(fanRank.rarity)}`,
              }}
            />
            {fanRank.rank === 1 && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="#FFCC00"
                className="absolute -right-1.5 -top-1.5"
              >
                <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.4a1 1 0 0 1-1 .85H5.6a1 1 0 0 1-1-.85z" />
              </svg>
            )}
          </span>
          <span className="min-w-0">
            <span
              className={`block text-[9px] font-extrabold tracking-widest ${
                fanRank.rank === 1 ? "text-[#FFCC00]" : "text-[#84819A]"
              }`}
            >
              {fanRank.rank === 1
                ? i18n.t("fandom.topFan")
                : i18n.t("fandom.rankOf", { rank: fanRank.rank, fans: fanRank.fans })}
            </span>
            <span className="block truncate text-sm font-bold">
              {i18n.t("fandom.standingCount", { name: fanRank.name, count: fanRank.count })}
            </span>
          </span>
        </Link>
      )}

      {collectionRank && (
        <Link
          to="/fandom?tab=collectors"
          className="flex items-center justify-between gap-3 text-xs transition-all hover:opacity-80"
        >
          <span className="text-[#84819A]">{i18n.t("fandom.charactersCollected")}</span>
          <span className="font-bold text-[#C9C6DE]">
            {collectionRank.distinct} &middot; #{collectionRank.rank}
          </span>
        </Link>
      )}
    </div>
  );
};

export default FanStanding;
