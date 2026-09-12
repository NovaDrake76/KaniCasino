import Skeleton from "react-loading-skeleton";
import ArcadeShell from "../components/ArcadeShell";
import GuessSearch from "./components/GuessSearch";
import GuessRows from "./components/GuessRows";
import HintBoard from "./components/HintBoard";
import ResultPanel from "./components/ResultPanel";
import StatsPanel from "./components/StatsPanel";
import TodayStrip from "./components/TodayStrip";
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
  <ArcadeShell game={i18n.t("arcade.halo.title")}>
    <header className="flex flex-col items-center gap-2 text-center">
      <h1 className="m-0 text-4xl font-extrabold italic tracking-tight md:text-5xl">
        <span className="text-[#5CC8FF]">Daily</span> Halo
      </h1>
      <p className="m-0 text-sm text-ink-soft">{i18n.t("arcade.halo.subtitle")}</p>
      {!loading && !failed && (
        <span className="bg-surface px-2 py-0.5 text-xs font-semibold text-ink-muted">
          {i18n.t("arcade.halo.number", { number })}
        </span>
      )}
    </header>

    {loading ? (
      <div className="flex flex-col gap-3">
        <Skeleton height={64} />
        <Skeleton height={48} />
        <Skeleton height={180} />
      </div>
    ) : failed ? (
      <div className="flex flex-col items-center gap-3 bg-surface p-8 text-center">
        <p className="m-0 text-ink-soft">{i18n.t("arcade.halo.loadFailed")}</p>
        <button type="button" onClick={retry} className="border-none bg-accent px-4 py-2 text-sm font-bold text-white hover:border-none">
          {i18n.t("arcade.halo.retry")}
        </button>
      </div>
    ) : (
      <>
        <TodayStrip clock={clock} solves={solves} averageGuesses={averageGuesses} yesterday={yesterday} />

        {finished && answer ? (
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
        ) : (
          <>
            {rows.length === 0 && <p className="m-0 text-center text-sm text-ink-muted">{i18n.t("arcade.halo.howTo")}</p>}
            <GuessSearch
              term={term}
              setTerm={setTerm}
              suggestions={suggestions}
              pick={pick}
              pickFirst={pickFirst}
              submitting={submitting}
              guessesLeft={guessesLeft}
            />
            <HintBoard hints={hints} />
          </>
        )}

        <GuessRows rows={rows} />

        {signedIn && stats ? (
          <StatsPanel stats={stats} winRate={winRate} distribution={distribution} topBar={topBar} today={won ? guessCount : null} />
        ) : (
          !finished && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#5CC8FF]/10 px-4 py-3">
              <span className="text-sm text-ink-soft">
                {i18n.t("arcade.halo.signInLine", { amount: bestReward.toLocaleString("en-US") })}
              </span>
              <button
                type="button"
                onClick={signIn}
                className="border-none bg-[#5CC8FF] px-4 py-2 text-sm font-bold text-[#04121c] hover:border-none hover:bg-[#8FDBFF]"
              >
                {i18n.t("arcade.halo.signIn")}
              </button>
            </div>
          )
        )}
      </>
    )}
  </ArcadeShell>
);

export default DailyHaloView;
