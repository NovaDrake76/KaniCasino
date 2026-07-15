import { IconType } from "react-icons";
import { GiOpenChest } from "react-icons/gi";
import { FiUser, FiUsers } from "react-icons/fi";
import { FaDiscord, FaTwitter } from "react-icons/fa";

// contextual art per mission: reuse the app's real game/case assets where a mission
// maps to one, and fall back to a themed icon for the rest (avatar, friend, socials).

// static public assets, the same art the home game listing and slot big-win use
const IMG: Record<string, string> = {
  "try-crash": "/images/crash/idle.gif",
  "try-coinflip": "/images/coinHeads.webp",
  "coinflip-win": "/images/coinTails.webp",
  "try-slots": "/images/slot/wild.webp",
  "battle-win": "/images/boo.webp",
  "big-win": "/images/slot/bigwin.webp",
  "first-bonus": "/images/clock.webp",
  "first-sale": "/images/item1.webp",
};

// missions that show a real case image, supplied at runtime from the cases list
const CASE_ART = new Set(["first-case", "cases-10", "cases-100", "complete-collection"]);

const ICON: Record<string, IconType> = {
  "set-avatar": FiUser,
  "add-friend": FiUsers,
  "join-discord": FaDiscord,
  "follow-x": FaTwitter,
};

export interface MissionArt {
  img?: string;
  Icon?: IconType;
}

export function resolveMissionArt(key: string, caseImage?: string): MissionArt {
  if (IMG[key]) return { img: IMG[key] };
  if (CASE_ART.has(key)) return caseImage ? { img: caseImage } : { Icon: GiOpenChest };
  if (ICON[key]) return { Icon: ICON[key] };
  return { Icon: GiOpenChest };
}

export const MissionArtTile: React.FC<{ art: MissionArt; dim?: boolean }> = ({ art, dim }) => (
  <div
    className={`w-14 h-14 shrink-0 rounded-lg bg-surface-nav border border-line flex items-center justify-center overflow-hidden ${
      dim ? "opacity-50 grayscale" : ""
    }`}
  >
    {art.img ? (
      <img src={art.img} alt="" className="max-h-12 max-w-12 object-contain" />
    ) : art.Icon ? (
      <art.Icon className="text-2xl text-accent-gold" />
    ) : null}
  </div>
);
