import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BsBroadcast, BsHammer } from "react-icons/bs";
import { Badge as BadgeData, BadgeKey } from "../services/badges/BadgeService";
import { rarityColor, rarityName } from "../utils/rarity";
import i18n from "../i18n";

interface BadgeProps {
  badge?: BadgeData | null;
  size?: "inline" | "large";
  linked?: boolean;
  // off where the surrounding row already opens a preview of its own, so a hover does
  // not stack two cards on top of each other
  hoverCard?: boolean;
}

const MARK = { inline: "h-[18px] w-[18px]", large: "h-6 w-6", xl: "h-10 w-10" };
const CARD_GAP = 10;
const CARD_W = 240;

// one mark per badge, all the same size and shape. the detail that tells them apart lives
// in the hover card, because a 18px picture of anything is unreadable in a table row.
export const BADGE_KEYS: BadgeKey[] = ["topFan", "contributor", "connected"];

const FACE: Record<BadgeKey, { from: string; to: string; ink: string; icon: JSX.Element }> = {
  topFan: {
    from: "#FFCC00",
    to: "#E0A213",
    ink: "#3B2A00",
    icon: (
      <svg width="70%" height="70%" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.4a1 1 0 0 1-1 .85H5.6a1 1 0 0 1-1-.85z" />
      </svg>
    ),
  },
  contributor: {
    from: "#8B7BF0",
    to: "#4F46E5",
    ink: "#ffffff",
    icon: <BsHammer size="65%" />,
  },
  connected: {
    from: "#5865F2",
    to: "#3B45AE",
    ink: "#ffffff",
    icon: <BsBroadcast size="68%" />,
  },
};

export const BadgeFace: React.FC<{
  badgeKey: BadgeKey;
  size?: keyof typeof MARK;
  muted?: boolean;
}> = ({ badgeKey, size = "inline", muted = false }) => {
  const face = FACE[badgeKey];
  if (!face) return null;
  return (
    <span
      style={
        muted
          ? { backgroundImage: "linear-gradient(to bottom, #3A365A, #2A2840)", color: "#625F7E" }
          : { backgroundImage: `linear-gradient(to bottom, ${face.from}, ${face.to})`, color: face.ink }
      }
      className={`notched-xs inline-flex shrink-0 items-center justify-center ${MARK[size]}`}
    >
      {face.icon}
    </span>
  );
};

const Badge: React.FC<BadgeProps> = ({ badge, size = "inline", linked = true, hoverCard = true }) => {
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

  if (!badge || !FACE[badge.key]) return null;

  const face = FACE[badge.key];
  const name = i18n.t(`badge.${badge.key}`);
  const fandom = badge.fandom;
  const label = fandom ? i18n.t("fandom.badgeTitle", { name: fandom.name, count: fandom.count }) : name;
  const rivals = fandom ? Math.max(0, fandom.fans - 1) : 0;

  const face_ = (
    <span
      ref={mark}
      onMouseEnter={() => hoverCard && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      title={hoverCard ? undefined : label}
      style={{ backgroundImage: `linear-gradient(to bottom, ${face.from}, ${face.to})`, color: face.ink }}
      className={`notched-xs inline-flex shrink-0 items-center justify-center ${MARK[size]}`}
    >
      {face.icon}
    </span>
  );

  const card =
    hovered &&
    createPortal(
      <div
        style={{ top: at.top, left: at.left, width: CARD_W }}
        className="notched pointer-events-none fixed z-[130] bg-[#212031] p-3 shadow-2xl"
      >
        <p className="text-[9px] font-extrabold tracking-[0.14em]" style={{ color: face.from }}>
          {name.toUpperCase()}
        </p>

        {fandom ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <img
                src={fandom.image}
                alt={fandom.name}
                className="notched-sm h-16 w-16 shrink-0 bg-[#19172d] object-contain"
                style={{ borderBottom: `3px solid ${rarityColor(fandom.rarity)}` }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{fandom.name}</p>
                <p className="text-[11px]" style={{ color: rarityColor(fandom.rarity) }}>
                  {rarityName(fandom.rarity)}
                </p>
                <p className="mt-1 text-lg font-extrabold leading-none text-[#FFCC00]">
                  {fandom.count}
                  <span className="ml-1 text-[10px] font-semibold text-[#84819A]">
                    {i18n.t("fandom.copies")}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-2 border-t border-[#2A2840] pt-2 text-[11px] text-[#84819A]">
              {i18n.t(
                rivals === 0
                  ? "fandom.aheadOfFansNone"
                  : rivals === 1
                  ? "fandom.aheadOfFansOne"
                  : "fandom.aheadOfFans",
                { count: rivals }
              )}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-[12px] leading-relaxed text-[#C9C6DE]">
              {i18n.t(`badge.${badge.key}Hint`)}
            </p>
            {badge.note && <p className="mt-2 text-[11px] italic text-[#84819A]">{badge.note}</p>}
            {badge.awardedAt && (
              <p className="mt-2 border-t border-[#2A2840] pt-2 text-[11px] text-[#84819A]">
                {i18n.t("badge.awarded", { date: new Date(badge.awardedAt).toLocaleDateString() })}
              </p>
            )}
          </>
        )}
      </div>,
      document.body
    );

  if (!linked || !fandom)
    return (
      <>
        {face_}
        {card}
      </>
    );

  return (
    <>
      <Link to={`/fandom/${encodeURIComponent(fandom.name)}`} onClick={(e) => e.stopPropagation()}>
        {face_}
      </Link>
      {card}
    </>
  );
};

export default Badge;
