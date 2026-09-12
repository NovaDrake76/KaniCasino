import { FaTrophy } from "react-icons/fa";
import { FiClock } from "react-icons/fi";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  loading: boolean;
  finished: boolean;
  number: number;
  guessesLeft: number;
  solves: number;
  averageGuesses: number | null;
  clock: string;
  yesterday: { name: string; academy: string; studentImage: string } | null;
}

const Divider = ({ tone }: { tone: string }) => <div className={`h-px w-12 bg-gradient-to-r from-transparent ${tone} to-transparent`} />;

const HaloHeader = ({ loading, finished, number, guessesLeft, solves, averageGuesses, clock, yesterday }: Props) => (
  <header className="relative mb-8 text-center">
    <div className="relative inline-block">
      <div className="absolute inset-0 scale-150 bg-blue-500 opacity-20 blur-3xl" />
      <h1 className="relative m-0 mb-3 [transform:skewX(-9deg)] text-6xl font-bold italic tracking-tight text-[#0a8bfa] drop-shadow-[0_2px_8px_rgba(10,139,250,0.5)] md:text-7xl">
        Daily <span className="text-[#272727] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">Halo</span>
      </h1>
    </div>

    <div className="mt-2 flex items-center justify-center gap-3">
      <Divider tone="via-slate-400" />
      <p className="m-0 text-xs font-semibold uppercase tracking-widest text-slate-500">Schale Database</p>
      <Divider tone="via-slate-400" />
    </div>

    {!finished && <p className="m-0 mt-6 text-lg font-medium text-slate-600">{i18n.t("arcade.halo.tagline")}</p>}
    {!finished && !loading && (
      <p className={`m-0 mt-2 text-sm font-bold ${guessesLeft <= 3 ? "text-red-500" : "text-slate-500"}`}>
        {i18n.t("arcade.halo.attemptsLeft", { count: guessesLeft })}
      </p>
    )}

    {!loading && (
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span
          title={averageGuesses !== null ? i18n.t("arcade.halo.averageGuesses", { avg: averageGuesses }) : undefined}
          className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm"
        >
          <FaTrophy className="text-amber-500" /> {i18n.t("arcade.halo.solvedToday", { count: solves })}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
          <FiClock className="text-[#0a8bfa]" /> {i18n.t("arcade.halo.nextStudent")}
          <span className="font-mono text-[#0a8bfa]">{clock}</span>
        </span>
        {yesterday && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 text-sm font-bold text-slate-600 shadow-sm">
            <StudentPortrait variant="dot" src={yesterday.studentImage} name={yesterday.name} />
            {i18n.t("arcade.halo.yesterday")}: <span className="text-slate-800">{yesterday.name}</span>
          </span>
        )}
        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-bold text-white">{i18n.t("arcade.halo.number", { number })}</span>
      </div>
    )}
  </header>
);

export default HaloHeader;
