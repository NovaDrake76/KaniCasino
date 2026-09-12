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
    <span className="text-3xl font-black text-slate-800">{value}</span>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
  </div>
);

const StatsPanel = ({ stats, winRate, distribution, topBar, today }: Props) => (
  <section className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
    <div className="mb-5 flex items-center justify-center gap-3">
      <div className="h-px w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
      <h2 className="m-0 text-sm font-black uppercase tracking-widest text-blue-600">{i18n.t("arcade.halo.statsTitle")}</h2>
      <div className="h-px w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
    </div>
    <div className="mb-6 grid grid-cols-4 gap-2">
      <Figure value={stats.played} label={i18n.t("arcade.halo.played")} />
      <Figure value={`${winRate}%`} label={i18n.t("arcade.halo.winRate")} />
      <Figure value={stats.currentStreak} label={i18n.t("arcade.halo.streak")} />
      <Figure value={stats.bestStreak} label={i18n.t("arcade.halo.bestStreak")} />
    </div>
    <p className="m-0 mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">{i18n.t("arcade.halo.distribution")}</p>
    <div className="mx-auto flex max-w-xl flex-col gap-1.5">
      {distribution.map((count, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-5 text-right font-bold text-slate-400">{i + 1}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`flex h-full items-center justify-end rounded-full px-2 font-black text-white ${today === i + 1 ? "bg-emerald-500" : count > 0 ? "bg-[#0a8bfa]" : "bg-slate-300"}`}
              style={{ width: `${Math.max(9, (count / topBar) * 100)}%` }}
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
