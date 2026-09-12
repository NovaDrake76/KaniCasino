import { Link } from "react-router-dom";
import { FiClock, FiUsers } from "react-icons/fi";
import Monetary from "../../../components/Monetary";
import ArcadeShell from "../components/ArcadeShell";
import { academyLogo } from "../DailyHalo/dailyHalo.logic";
import type { ArcadeHomeViewProps } from "./ArcadeHome.types";
import i18n from "../../../i18n";

const STATUS_TONE = {
  solved: "bg-emerald-500 text-white",
  missed: "bg-red-500 text-white",
  playing: "bg-accent-gold text-[#2a2100]",
  new: "bg-[#5CC8FF] text-[#04121c]",
};

const LOGOS = ["Trinity", "Gehenna", "Millennium", "Abydos", "Hyakkiyako", "Red Winter"];

const ArcadeHomeView: React.FC<ArcadeHomeViewProps> = ({ loaded, number, clock, solves, status, bestReward }) => (
  <ArcadeShell>
    <header className="flex flex-col gap-2">
      <h1 className="m-0 text-4xl font-extrabold tracking-tight md:text-5xl">{i18n.t("arcade.title")}</h1>
      <p className="m-0 max-w-2xl text-sm text-ink-soft">{i18n.t("arcade.tagline")}</p>
    </header>

    <div className="grid gap-4 md:grid-cols-2">
      <Link
        to="/arcade/daily-halo"
        className="group relative flex min-h-[16rem] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0B3A5C] via-[#10223B] to-[#141225] p-6 hover:from-[#0E4A74]"
      >
        <div className="pointer-events-none absolute -right-6 -top-6 grid grid-cols-3 gap-3 opacity-20 transition-opacity group-hover:opacity-30">
          {LOGOS.map((name) => {
            const logo = academyLogo(name);
            return logo ? <img key={name} src={logo} alt="" className="h-16 w-16 object-contain" /> : null;
          })}
        </div>
        <div className="relative flex flex-col gap-2">
          <span className={`self-start px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
            {i18n.t(`arcade.status.${status}`)}
          </span>
          <h2 className="m-0 text-3xl font-extrabold italic text-ink">
            <span className="text-[#5CC8FF]">Daily</span> Halo
          </h2>
          <p className="m-0 max-w-sm text-sm text-ink-soft">{i18n.t("arcade.halo.subtitle")}</p>
          {bestReward !== null && (
            <p className="m-0 text-xs text-ink-muted">
              {i18n.t("arcade.upTo")} <span className="font-bold text-accent-gold"><Monetary value={bestReward} /></span>
            </p>
          )}
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1 text-xs text-ink-soft">
            {loaded && number !== null && <span className="font-semibold">{i18n.t("arcade.halo.number", { number })}</span>}
            {clock && (
              <span className="flex items-center gap-1.5">
                <FiClock /> {i18n.t("arcade.halo.nextStudent")} <span className="font-mono font-bold text-ink">{clock}</span>
              </span>
            )}
            {loaded && (
              <span className="flex items-center gap-1.5">
                <FiUsers /> {i18n.t("arcade.halo.solvedToday", { count: solves })}
              </span>
            )}
          </div>
          <span className="bg-[#5CC8FF] px-5 py-2 text-sm font-bold text-[#04121c] group-hover:bg-[#8FDBFF]">
            {i18n.t("arcade.play")}
          </span>
        </div>
      </Link>

      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 border border-dashed border-line p-6 text-center">
        <span className="text-lg font-bold text-ink-soft">{i18n.t("arcade.comingSoonTitle")}</span>
        <span className="max-w-xs text-sm text-ink-muted">{i18n.t("arcade.comingSoonLine")}</span>
      </div>
    </div>
  </ArcadeShell>
);

export default ArcadeHomeView;
