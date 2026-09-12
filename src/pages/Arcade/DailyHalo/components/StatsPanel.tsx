import type { HaloStats } from "../../../../services/arcade/DailyHaloService";
import i18n from "../../../../i18n";

interface Props {
  stats: HaloStats;
  winRate: number;
  distribution: number[];
  topBar: number;
  // the bar today's win landed on, highlighted
  today: number | null;
}

const Figure = ({ value, label }: { value: string | number; label: string }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-2xl font-extrabold text-ink">{value}</span>
    <span className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
  </div>
);

const StatsPanel = ({ stats, winRate, distribution, topBar, today }: Props) => (
  <section className="flex flex-col gap-4 bg-surface p-5">
    <h2 className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">{i18n.t("arcade.halo.statsTitle")}</h2>
    <div className="grid grid-cols-4 gap-2">
      <Figure value={stats.played} label={i18n.t("arcade.halo.played")} />
      <Figure value={`${winRate}%`} label={i18n.t("arcade.halo.winRate")} />
      <Figure value={stats.currentStreak} label={i18n.t("arcade.halo.streak")} />
      <Figure value={stats.bestStreak} label={i18n.t("arcade.halo.bestStreak")} />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">{i18n.t("arcade.halo.distribution")}</span>
      {distribution.map((count, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-4 text-right text-ink-muted">{i + 1}</span>
          <div className="h-5 flex-1 bg-surface-nav">
            <div
              className={`flex h-full items-center justify-end px-1.5 font-bold ${today === i + 1 ? "bg-emerald-500 text-white" : "bg-surface-hover text-ink-soft"}`}
              style={{ width: `${Math.max(8, (count / topBar) * 100)}%` }}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default StatsPanel;
