import { IconType } from "react-icons";
import { GiOpenChest, GiTwoCoins, GiMoneyStack } from "react-icons/gi";
import { FiUser, FiUsers } from "react-icons/fi";
import { FaDiscord, FaTwitter, FaMedal, FaCoins } from "react-icons/fa";
import { MdStorefront } from "react-icons/md";

// contextual art per mission: reuse the app's real game/case assets where a mission
// maps to one, and a themed icon otherwise (money, store, level, socials).

// static public assets, the same art the home game listing and slot big-win use
const IMG: Record<string, string> = {
  "try-crash": "/images/crash/idle.gif",
  "try-coinflip": "/images/coinHeads.webp",
  "coinflip-win": "/images/coinTails.webp",
  "try-slots": "/images/slot/wild.webp",
  "battle-win": "/images/boo.webp",
  "big-win": "/images/slot/bigwin.webp",
  "battles-10": "/images/boo.webp",
  "coinflip-25": "/images/coinHeads.webp",
  "crash-50": "/images/crash/idle.gif",
  "jackpot": "/images/slot/bigwin.webp",
};

// missions that show a real case image, supplied at runtime from the cases list
const CASE_ART = new Set([
  "first-case",
  "cases-10",
  "cases-100",
  "cases-1000",
  "complete-collection",
  "collections-all",
]);

const ICON: Record<string, IconType> = {
  "first-bonus": GiTwoCoins,
  "first-sale": MdStorefront,
  "market-10": MdStorefront,
  "wager-million": FaCoins,
  "millionaire": GiMoneyStack,
  "level-30": FaMedal,
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
      <art.Icon className="text-3xl text-accent-gold" />
    ) : null}
  </div>
);
