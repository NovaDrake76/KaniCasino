import { FaLock, FaCheck } from "react-icons/fa";
import BoostCard, { Chip } from "./BoostCard";
import { boost } from "./Gift.services";
import type { TopSlotRung } from "./Gift.types";
import i18n from "../../i18n";

// the ladder itself, not a sentence about it. a player reading "level 60 unlocks the 10x
// rung" cannot see what they already hold or how far the next one is; the rows can say
// both at a glance, which is the whole reason the locked tiers are public.
const Rung = ({ rung }: { rung: TopSlotRung }) => (
  <div
    className={`grid grid-cols-[16px_46px_minmax(0,1fr)] items-center gap-2.5 px-3 py-2 ${
      rung.locked ? "bg-surface-nav" : "bg-surface-raised"
    }`}
  >
    {rung.locked ? (
      <FaLock className="text-[10px] text-ink-faint" />
    ) : (
      <FaCheck className="text-[10px] text-accent-gold" />
    )}
    <span className={`text-[15px] font-extrabold tabular-nums ${rung.locked ? "text-ink-faint" : "text-white"}`}>
      {rung.multiplier}x
    </span>
    <span className="truncate text-right text-[11px] tabular-nums text-ink-muted">
      {rung.locked
        ? i18n.t("gift.unlocksAt", { level: rung.minLevel })
        : i18n.t("gift.chanceOf", { chance: rung.chance })}
    </span>
  </div>
);

const Gap = () => (
  <div className="py-0.5 text-center text-[10px] tracking-[0.3em] text-ink-faint">...</div>
);

const ROWS = 3;

// the whole ladder was five rows of mostly settled history. a rung already earned says
// nothing a player needs twice, so the card shows the best one they hold, the ones they are
// working toward, and always the top rung: the moonshot is the reason the list is public.
export const visibleRungs = (rungs: TopSlotRung[]) => {
  const real = rungs.filter((r) => r.multiplier > 1);
  if (!real.length) return { rows: [], gapBefore: null as number | null };

  const top = real[real.length - 1];
  const earned = real.filter((r) => !r.locked);
  const locked = real.filter((r) => r.locked);

  const rows: TopSlotRung[] = [];
  if (earned.length) rows.push(earned[earned.length - 1]);
  for (const rung of locked) {
    if (rows.length >= ROWS - 1) break;
    rows.push(rung);
  }
  if (!rows.includes(top) && rows.length >= ROWS - 1) rows.push(top);
  else if (!rows.includes(top)) rows.push(top);

  // a jump was made if the row before the top is not the rung immediately under it
  const beforeTop = rows[rows.length - 2];
  const topIndex = real.indexOf(top);
  const gapBefore =
    beforeTop && real.indexOf(beforeTop) < topIndex - 1 ? top.multiplier : null;

  return { rows, gapBefore };
};

const LevelRungs = ({ rungs, level, average }: { rungs: TopSlotRung[]; level: number; average: number }) => {
  const next = rungs.find((r) => r.locked);
  const { rows, gapBefore } = visibleRungs(rungs);

  return (
    <BoostCard
      label={i18n.t("gift.levelBoost")}
      status={<Chip tone="muted">{i18n.t("gift.levelN", { level })}</Chip>}
      footValue={boost(average)}
      footNote={
        next
          ? i18n.t("gift.averageRisingAt", { level: next.minLevel, multiplier: next.multiplier })
          : i18n.t("gift.averageTopSlot")
      }
    >
      <div className="flex flex-col gap-[3px]">
        {rows.map((r) => (
          <div key={r.multiplier}>
            {gapBefore === r.multiplier && <Gap />}
            <Rung rung={r} />
          </div>
        ))}
      </div>
    </BoostCard>
  );
};

export default LevelRungs;
