import { FaStar } from "react-icons/fa";
import BoostCard, { Chip, betterPrizes } from "./BoostCard";
import { gain } from "./Gift.services";
import i18n from "../../i18n";

interface LadderProps {
  streak: number;
  streakMax: number;
  rareBoost: number;
  bestBoost: number;
  canSpin: boolean;
}

type DayState = "done" | "today" | "todo" | "bonus" | "bonusDone";

// the tiles carry their own depth rather than sitting flat on the card: a lit top edge, a
// dark floor and a face that falls away, which is what makes a row of squares read as a
// row of buttons. the last one is the prize, so it gets the light behind it.
const FACE: Record<DayState, string> = {
  done: "linear-gradient(#3c3468, #2a2447)",
  today: "linear-gradient(#ffd84a, #e9a90f)",
  todo: "linear-gradient(#221f3a, #1a1830)",
  bonus: "linear-gradient(#2f2a52, #221d3f)",
  bonusDone: "linear-gradient(#ffd84a, #e9a90f)",
};

const SHADOW: Record<DayState, string> = {
  done: "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 0 #16142a",
  today: "inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 0 #8a6100, 0 0 18px rgba(255,204,0,0.35)",
  todo: "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 0 #131126",
  bonus: "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 0 #16142a",
  bonusDone: "inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 0 #8a6100, 0 0 18px rgba(255,204,0,0.35)",
};

const INK: Record<DayState, string> = {
  done: "text-ink-soft",
  today: "text-[#2a2100]",
  todo: "text-ink-faint",
  bonus: "text-accent-gold",
  bonusDone: "text-[#2a2100]",
};

const Day = ({ day, state }: { day: number; state: DayState }) => {
  const isBonus = state === "bonus" || state === "bonusDone";
  const isToday = state === "today";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      {/* the rays sit behind the last tile only, which is what makes it read as the prize
          at the end of the row rather than one more day */}
      {isBonus && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-3 left-1/2 h-[86px] w-[86px] -translate-x-1/2 opacity-45"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(255,204,0,0.55) 0deg 9deg, transparent 9deg 22deg)",
            maskImage: "radial-gradient(circle, #000 10%, transparent 66%)",
            WebkitMaskImage: "radial-gradient(circle, #000 10%, transparent 66%)",
          }}
        />
      )}

      <div
        className={`relative flex h-12 w-full items-center justify-center text-[18px] font-extrabold tabular-nums ${INK[state]} ${
          isToday ? "scale-[1.08]" : ""
        }`}
        style={{ background: FACE[state], boxShadow: SHADOW[state] }}
      >
        {isBonus && <FaStar className="absolute right-1 top-1 text-[8px] opacity-80" />}
        {day}
      </div>

      {/* one label slot, always the same height, so a marked tile never shunts its
          neighbours out of line the way a per-tile caption did */}
      <div className="mt-1.5 flex h-[15px] items-center">
        {isToday && (
          <span className="whitespace-nowrap bg-accent-gold px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#2a2100]">
            {i18n.t("gift.today")}
          </span>
        )}
        {isBonus && !isToday && (
          <span className="whitespace-nowrap bg-accent-amber px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#2a2100]">
            {i18n.t("gift.bonus")}
          </span>
        )}
      </div>
    </div>
  );
};

const StreakLadder = ({ streak, streakMax, rareBoost, bestBoost, canSpin }: LadderProps) => {
  const atBest = streak >= streakMax;
  // the day this spin would land on is the one worth marking. once it is taken there is
  // nothing pending and the streak itself is where they stand.
  const pending = canSpin ? Math.min(streak + 1, streakMax) : streak;

  const stateFor = (day: number): DayState => {
    if (day === streakMax) return day <= streak ? "bonusDone" : "bonus";
    if (day === pending && canSpin) return "today";
    return day <= streak ? "done" : "todo";
  };

  return (
    <BoostCard
      label={i18n.t("gift.streakBoost")}
      status={
        atBest ? (
          <Chip tone="live">{i18n.t("gift.fullStreak")}</Chip>
        ) : (
          <Chip tone="muted">{i18n.t("gift.dayOf", { day: streak, of: streakMax })}</Chip>
        )
      }
      footValue={gain(rareBoost)}
      footNote={
        atBest
          ? betterPrizes()
          : i18n.t("gift.risingTo", { value: gain(bestBoost), day: streakMax })
      }
    >
      <div className="flex gap-1.5">
        {Array.from({ length: streakMax }, (_, i) => (
          <Day key={i} day={i + 1} state={stateFor(i + 1)} />
        ))}
      </div>
    </BoostCard>
  );
};

export default StreakLadder;
