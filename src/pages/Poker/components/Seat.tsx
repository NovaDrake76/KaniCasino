import { motion } from "framer-motion";
import Avatar from "../../../components/Avatar";
import Monetary from "../../../components/Monetary";
import PlayingCard from "../../../components/game/PlayingCard";
import { pokerToDisplay } from "../../../components/game/cards";
import { rarityColor } from "../../../utils/rarity";
import { PokerSeat, PooledItem } from "../../../services/poker/PokerService";
import i18n from "../../../i18n";

interface SeatProps {
  seat: PokerSeat;
  isHero: boolean;
  isButton: boolean;
  isToAct: boolean;
  secondsLeft: number | null;
  totalSeconds: number;
  holding: PooledItem[];
  atRiskIds: Set<string>;
  onSit: () => void;
  // the ring does not fit a phone, so below lg the seats are stacked and shrunk instead
  compact?: boolean;
}

// the depleting ring on the acting player's avatar. a number would be read as a score;
// a ring is read as pressure, which is what it is.
const TimerRing = ({ fraction }: { fraction: number }) => {
  const size = 52;
  const r = 24;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3A365A" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={fraction < 0.3 ? "#EB4B4B" : "#4F46E5"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: "stroke-dashoffset 0.25s linear" }}
      />
    </svg>
  );
};

// what this player can still redeem out of the cage, with anything they can no longer
// afford lit in its rarity colour. this is the whole story of the table in one strip.
const Holding = ({ items, atRiskIds }: { items: PooledItem[]; atRiskIds: Set<string> }) => {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {items.map((item) => {
        const risked = atRiskIds.has(item.uniqueId);
        const color = rarityColor(item.rarity);
        return (
          <motion.div
            key={item.uniqueId}
            title={`${item.name} (${item.value})`}
            animate={risked ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={risked ? { duration: 1.4, repeat: Infinity } : undefined}
            className="notched-xs p-[1.5px]"
            style={{ backgroundColor: risked ? color : "#3A365A" }}
          >
            <div className="notched-xs bg-[#19172d] p-0.5">
              <img src={item.image} alt={item.name} className="h-6 w-6 object-contain" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const STATUS_LABEL: Record<string, string> = {
  folded: "poker.folded",
  allin: "poker.allIn",
  sittingout: "poker.sittingOut",
};

const Seat = ({
  seat,
  isHero,
  isButton,
  isToAct,
  secondsLeft,
  totalSeconds,
  holding,
  atRiskIds,
  onSit,
  compact = false,
}: SeatProps) => {
  const width = compact ? "w-[98px]" : "w-[124px]";
  const cardWidth = compact ? "[&>*]:!w-9" : "[&>*]:!w-12";

  if (!seat.userId) {
    return (
      <button
        onClick={onSit}
        className={`notched flex ${compact ? "h-[78px]" : "h-[104px]"} ${width} flex-col items-center justify-center gap-1 bg-[#212031]/70 text-xs font-semibold text-[#84819A] transition-all hover:bg-[#281D3F] hover:text-white`}
      >
        <span className="text-2xl leading-none">+</span>
        {i18n.t("poker.sitHere")}
      </button>
    );
  }

  const folded = seat.status === "folded";
  const fraction = secondsLeft === null ? 1 : Math.max(0, Math.min(1, secondsLeft / totalSeconds));

  return (
    <div className={`flex ${width} flex-col items-center gap-1 ${folded ? "opacity-45" : ""}`}>
      {!!seat.holeCards?.length && (
        <div className={`flex -space-x-2.5 ${cardWidth}`}>
          {seat.holeCards.map((card, i) => (
            <PlayingCard key={`${card}-${i}`} card={pokerToDisplay(card)} delay={i * 0.08} />
          ))}
        </div>
      )}
      {!seat.holeCards?.length && seat.status === "active" && (
        <div className={`flex -space-x-2.5 ${cardWidth}`}>
          <PlayingCard faceDown instant />
          <PlayingCard faceDown instant />
        </div>
      )}

      <div className="relative">
        <Avatar image={seat.profilePicture} id={seat.userId} size={compact ? "small" : "medium"} level={0} noLink />
        {isToAct && <TimerRing fraction={fraction} />}
        {isButton && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[#19172d]">
            D
          </span>
        )}
      </div>

      <div
        className="notched-sm w-full px-1 py-1 text-center"
        style={{ backgroundColor: isHero ? "#4F46E5" : "#212031" }}
      >
        <div className="truncate text-[11px] font-bold text-white">{seat.username}</div>
        <div className="text-[11px] font-semibold text-[#C9C6DE]">
          <Monetary value={seat.stack} />
        </div>
      </div>

      {STATUS_LABEL[seat.status] && (
        <span className="notched-xs bg-[#3A365A] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[#C9C6DE]">
          {i18n.t(STATUS_LABEL[seat.status])}
        </span>
      )}

      <Holding items={holding} atRiskIds={atRiskIds} />

      {seat.committed > 0 && (
        <motion.div
          layout
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="notched-xs bg-[#19172d] px-2 py-0.5 text-[11px] font-bold text-[#FFCC00]"
        >
          <Monetary value={seat.committed} />
        </motion.div>
      )}
    </div>
  );
};

export default Seat;
