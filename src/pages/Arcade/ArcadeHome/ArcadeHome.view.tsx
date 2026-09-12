import { Link } from "react-router-dom";
import { FaTrophy } from "react-icons/fa";
import { FiClock } from "react-icons/fi";
import Monetary from "../../../components/Monetary";
import ArcadeShell from "../components/ArcadeShell";
import type { ArcadeHomeViewProps } from "./ArcadeHome.types";
import i18n from "../../../i18n";

const STATUS_TONE = {
  solved: "bg-emerald-500 text-white",
  missed: "bg-red-500 text-white",
  playing: "bg-amber-400 text-amber-950",
  new: "bg-[#0a8bfa] text-white",
};

const ArcadeHomeView: React.FC<ArcadeHomeViewProps> = ({ loaded, number, clock, solves, status, bestReward }) => (
  <ArcadeShell>
    <header className="flex flex-col gap-2">
      <h1 className="m-0 text-4xl font-extrabold tracking-tight md:text-5xl">{i18n.t("arcade.title")}</h1>
      <p className="m-0 max-w-2xl text-sm text-ink-soft">{i18n.t("arcade.tagline")}</p>
    </header>

    <div className="grid gap-5 md:grid-cols-2">
      <Link
        to="/arcade/daily-halo"
        className="group relative flex min-h-[19rem] overflow-hidden rounded-3xl bg-[url('/images/arcade/halo-bg.webp')] bg-cover bg-center p-4 shadow-xl"
      >
        <div className="flex w-full flex-col justify-between gap-4 rounded-2xl bg-white/80 p-6 text-slate-800 backdrop-blur-md transition-colors group-hover:bg-white/90">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="relative inline-block">
                <div className="absolute inset-0 scale-125 bg-blue-500 opacity-20 blur-2xl" />
                <h2 className="relative m-0 [transform:skewX(-9deg)] text-5xl font-bold italic tracking-tight text-[#0a8bfa] drop-shadow-[0_2px_8px_rgba(10,139,250,0.5)]">
                  Daily <span className="text-[#272727] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">Halo</span>
                </h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-sm ${STATUS_TONE[status]}`}>
                {i18n.t(`arcade.status.${status}`)}
              </span>
            </div>
            <p className="m-0 text-base font-medium text-slate-600">{i18n.t("arcade.halo.tagline")}</p>
            <div className="flex flex-wrap gap-2">
              {loaded && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                  <FaTrophy className="text-amber-500" /> {i18n.t("arcade.halo.solvedToday", { count: solves })}
                </span>
              )}
              {clock && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                  <FiClock className="text-[#0a8bfa]" /> {i18n.t("arcade.halo.nextStudent")} <span className="font-mono text-[#0a8bfa]">{clock}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {loaded && number !== null && <>{i18n.t("arcade.halo.number", { number })} </>}
              {bestReward !== null && (
                <>
                  {i18n.t("arcade.upTo")} <span className="font-black text-amber-500"><Monetary value={bestReward} /></span>
                </>
              )}
            </span>
            <span className="rounded-xl bg-[#0a8bfa] px-8 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-colors group-hover:bg-blue-600">
              {i18n.t("arcade.play")}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex min-h-[19rem] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line p-6 text-center">
        <span className="text-lg font-bold text-ink-soft">{i18n.t("arcade.comingSoonTitle")}</span>
        <span className="max-w-xs text-sm text-ink-muted">{i18n.t("arcade.comingSoonLine")}</span>
      </div>
    </div>
  </ArcadeShell>
);

export default ArcadeHomeView;
