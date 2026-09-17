import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { GiGamepad } from "react-icons/gi";
import HaloHeader from "./components/HaloHeader";
import GuessSearch from "./components/GuessSearch";
import GuessRows from "./components/GuessRows";
import HintBoard from "./components/HintBoard";
import ResultPanel from "./components/ResultPanel";
import SignInNudge from "./components/SignInNudge";
import StatsPanel from "./components/StatsPanel";
import type { DailyHaloViewProps } from "./DailyHalo.types";
import i18n from "../../../i18n";

const DailyHaloView: React.FC<DailyHaloViewProps> = ({
  loading,
  failed,
  retry,
  number,
  maxGuesses,
  guessesLeft,
  finished,
  won,
  rows,
  guessCount,
  hints,
  answer,
  reward,
  adopted,
  bestReward,
  clock,
  solves,
  averageGuesses,
  yesterday,
  signedIn,
  signIn,
  term,
  setTerm,
  suggestions,
  pick,
  pickFirst,
  submitting,
  share,
  copied,
  stats,
  winRate,
  distribution,
  topBar,
}) => (
  <div className="relative w-full">
    <div
      aria-hidden
      className="absolute inset-0 bg-[url('/images/arcade/halo-bg.webp')] bg-cover bg-center md:bg-fixed"
    />
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 pb-16 pt-6 md:px-6 md:pt-10">
      <nav className="flex items-center justify-between text-sm text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
        <span className="flex items-center gap-2 font-bold">
          <Link to="/arcade" className="flex items-center gap-1.5 text-white hover:text-blue-100">
            <GiGamepad className="text-lg" /> {i18n.t("arcade.title")}
          </Link>
          <span className="opacity-70">/</span>
          <span>{i18n.t("arcade.halo.title")}</span>
        </span>
        <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white">
          <FiArrowLeft /> {i18n.t("arcade.backToCasino")}
        </Link>
      </nav>

      <div className="min-h-[70vh] rounded-3xl bg-white/80 px-3 py-8 text-slate-800 shadow-xl backdrop-blur-md md:px-8 md:py-12">
        <HaloHeader
          loading={loading || failed}
          finished={finished}
          number={number}
          guessesLeft={guessesLeft}
          solves={solves}
          averageGuesses={averageGuesses}
          clock={clock}
          yesterday={yesterday}
        />

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow-lg">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
              <span className="font-bold uppercase text-slate-700">{i18n.t("arcade.halo.loading")}</span>
            </div>
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="m-0 font-semibold text-slate-600">{i18n.t("arcade.halo.loadFailed")}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-xl border-none bg-[#0a8bfa] px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:border-none hover:bg-blue-600"
            >
              {i18n.t("arcade.halo.retry")}
            </button>
          </div>
        ) : (
          <>
            {!finished && guessCount >= 1 && <HintBoard hints={hints} attempts={guessCount} />}
            {!finished && (
              <GuessSearch term={term} setTerm={setTerm} suggestions={suggestions} pick={pick} pickFirst={pickFirst} submitting={submitting} />
            )}
            {finished && answer && (
              <ResultPanel
                won={won}
                answer={answer}
                guessCount={guessCount}
                maxGuesses={maxGuesses}
                reward={reward}
                adopted={adopted}
                streak={stats?.currentStreak ?? 0}
                signedIn={signedIn}
                bestReward={bestReward}
                signIn={signIn}
                share={share}
                copied={copied}
                clock={clock}
              />
            )}
            <GuessRows rows={rows} />
            {signedIn && stats ? (
              <StatsPanel stats={stats} winRate={winRate} distribution={distribution} topBar={topBar} today={won ? guessCount : null} />
            ) : (
              !finished && <SignInNudge bestReward={bestReward} signIn={signIn} />
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

export default DailyHaloView;
