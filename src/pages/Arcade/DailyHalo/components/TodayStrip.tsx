import { FiClock, FiUsers } from "react-icons/fi";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  clock: string;
  solves: number;
  averageGuesses: number | null;
  yesterday: { name: string; academy: string; studentImage: string } | null;
}

const TodayStrip = ({ clock, solves, averageGuesses, yesterday }: Props) => (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      <FiClock className="text-xl text-[#5CC8FF]" />
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">{i18n.t("arcade.halo.nextStudent")}</span>
        <span className="font-mono text-lg font-bold text-ink">{clock}</span>
      </div>
    </div>
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      <FiUsers className="text-xl text-[#5CC8FF]" />
      <div className="flex flex-col">
        <span className="text-lg font-bold text-ink">{i18n.t("arcade.halo.solvedToday", { count: solves })}</span>
        <span className="text-[11px] text-ink-muted">
          {averageGuesses !== null ? i18n.t("arcade.halo.averageGuesses", { avg: averageGuesses }) : i18n.t("arcade.halo.beFirst")}
        </span>
      </div>
    </div>
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      {yesterday ? (
        <>
          <StudentPortrait face src={yesterday.studentImage} name={yesterday.name} className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">{i18n.t("arcade.halo.yesterday")}</span>
            <span className="text-sm font-bold text-ink">{yesterday.name}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">{i18n.t("arcade.halo.yesterday")}</span>
          <span className="text-sm text-ink-soft">{i18n.t("arcade.halo.noYesterday")}</span>
        </div>
      )}
    </div>
  </div>
);

export default TodayStrip;
