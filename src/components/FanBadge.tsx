import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FanRank } from "../services/fandom/FandomService";
import { rarityColor, rarityName } from "../utils/rarity";
import i18n from "../i18n";

interface FanBadgeProps {
  fanRank?: FanRank | null;
  size?: "inline" | "large";
  linked?: boolean;
  // off where the surrounding row already opens a preview of its own, so a hover does
  // not stack two cards on top of each other
  hoverCard?: boolean;
}

const MARK = { inline: "h-[18px] w-[18px]", large: "h-6 w-6" };
const CARD_GAP = 10;
const CARD_W = 240;

// a crown on a gold field, the same mark for every fandom. the character art used to be
// the badge itself and at 18px nobody could tell who it was; it lives in the hover card
// now, big enough to recognise.
const FanBadge: React.FC<FanBadgeProps> = ({ fanRank, size = "inline", linked = true, hoverCard = true }) => {
  const [hovered, setHovered] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const mark = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!hovered || !mark.current) return;
    const box = mark.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, box.left + box.width / 2 - CARD_W / 2),
      window.innerWidth - CARD_W - 8
    );
    setAt({ top: box.bottom + CARD_GAP, left });
  }, [hovered]);

  if (!fanRank || fanRank.rank !== 1) return null;

  const label = i18n.t("fandom.badgeTitle", { name: fanRank.name, count: fanRank.count });
  const rivals = Math.max(0, fanRank.fans - 1);

  const badge = (
    <span
      ref={mark}
      onMouseEnter={() => hoverCard && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      title={hoverCard ? undefined : label}
      className={`notched-xs inline-flex shrink-0 items-center justify-center bg-gradient-to-b from-[#FFCC00] to-[#E0A213] ${MARK[size]}`}
    >
      <svg width="70%" height="70%" viewBox="0 0 24 24" fill="#3B2A00">
        <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.4a1 1 0 0 1-1 .85H5.6a1 1 0 0 1-1-.85z" />
      </svg>
    </span>
  );

  const card =
    hovered &&
    createPortal(
      <div
        style={{ top: at.top, left: at.left, width: CARD_W }}
        className="notched pointer-events-none fixed z-[130] bg-[#212031] p-3 shadow-2xl"
      >
        <p className="text-[9px] font-extrabold tracking-[0.14em] text-[#FFCC00]">
          {i18n.t("fandom.topFan")}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <img
            src={fanRank.image}
            alt={fanRank.name}
            className="notched-sm h-16 w-16 shrink-0 bg-[#19172d] object-contain"
            style={{ borderBottom: `3px solid ${rarityColor(fanRank.rarity)}` }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{fanRank.name}</p>
            <p className="text-[11px]" style={{ color: rarityColor(fanRank.rarity) }}>
              {rarityName(fanRank.rarity)}
            </p>
            <p className="mt-1 text-lg font-extrabold leading-none text-[#FFCC00]">
              {fanRank.count}
              <span className="ml-1 text-[10px] font-semibold text-[#84819A]">
                {i18n.t("fandom.copies")}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-2 border-t border-[#2A2840] pt-2 text-[11px] text-[#84819A]">
          {i18n.t(rivals === 0 ? "fandom.aheadOfFansNone" : rivals === 1 ? "fandom.aheadOfFansOne" : "fandom.aheadOfFans", {
            count: rivals,
          })}
        </p>
      </div>,
      document.body
    );

  if (!linked)
    return (
      <>
        {badge}
        {card}
      </>
    );

  return (
    <>
      <Link to={`/fandom/${encodeURIComponent(fanRank.name)}`} onClick={(e) => e.stopPropagation()}>
        {badge}
      </Link>
      {card}
    </>
  );
};

export default FanBadge;
