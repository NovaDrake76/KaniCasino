import { Link } from "react-router-dom";
import { FanRank } from "../services/fandom/FandomService";
import { rarityColor } from "../utils/rarity";
import i18n from "../i18n";

interface FanBadgeProps {
  fanRank?: FanRank | null;
  size?: "inline" | "row" | "full";
  linked?: boolean;
}

const ART = { inline: "w-[18px] h-[18px]", row: "w-[26px] h-[26px]", full: "w-6 h-6" };
const CROWN = { inline: 11, row: 14, full: 12 };

// only the person holding a board wears it. everyone else's standing lives on their profile.
const FanBadge: React.FC<FanBadgeProps> = ({ fanRank, size = "inline", linked = true }) => {
  if (!fanRank || fanRank.rank !== 1) return null;

  const color = rarityColor(fanRank.rarity);
  const label = i18n.t("fandom.badgeTitle", { name: fanRank.name, count: fanRank.count });

  const art = (
    <span className="relative inline-block shrink-0" title={label} aria-label={label}>
      <span
        className={`notched-sm block bg-[#3A2C5C] bg-cover bg-center ${ART[size]}`}
        style={{ backgroundImage: `url(${fanRank.image})`, borderBottom: `2px solid ${color}` }}
      />
      <svg
        width={CROWN[size]}
        height={CROWN[size]}
        viewBox="0 0 24 24"
        fill="#FFCC00"
        className="absolute -top-1.5 -right-1"
      >
        <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.4a1 1 0 0 1-1 .85H5.6a1 1 0 0 1-1-.85z" />
      </svg>
    </span>
  );

  const body =
    size === "full" ? (
      <span className="notched-sm inline-flex items-center gap-2 bg-[#212031] py-1.5 pl-2 pr-3">
        {art}
        <span className="flex flex-col leading-tight">
          <span className="text-[8px] font-extrabold tracking-[0.14em] text-[#FFCC00]">
            {i18n.t("fandom.topFan")}
          </span>
          <span className="text-[11px] font-bold">
            {fanRank.name} &middot; {fanRank.count}
          </span>
        </span>
      </span>
    ) : (
      art
    );

  if (!linked) return body;

  return (
    <Link to={`/fandom/${encodeURIComponent(fanRank.name)}`} onClick={(e) => e.stopPropagation()}>
      {body}
    </Link>
  );
};

export default FanBadge;
