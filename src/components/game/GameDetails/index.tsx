import { useState } from "react";
import { FiInfo } from "react-icons/fi";
import LiveBets from "../LiveBets";
import GameInfo from "./GameInfo";
import type { GameKey, InfoContext } from "./content";
import i18n from "../../../i18n";

type Tab = "bets" | "info";

interface GameDetailsProps {
  game: GameKey;
  // a live game shows the bets on the current round instead of the site-wide feed
  roundBets?: React.ReactNode;
  // what sits at the right of the tabs while the round's bets are showing
  roundSummary?: React.ReactNode;
  // upgrade and battles are not in the feed, so they show the game info alone
  feed?: boolean;
  // live values the info should quote, like what the coin's sides pay right now
  info?: InfoContext;
  className?: string;
}

const TAB =
  "-mb-px flex min-h-[44px] items-center gap-2 rounded-none border-0 border-b-2 bg-transparent px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:text-ink";

// the strip under every game: its bets, live or on the round, beside what the game is and how it pays
const GameDetails = ({ game, roundBets, roundSummary, feed = true, info, className = "max-w-[1200px]" }: GameDetailsProps) => {
  const hasBets = !!roundBets || feed;
  const [tab, setTab] = useState<Tab>("bets");
  const shown: Tab = hasBets ? tab : "info";

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    ...(hasBets
      ? [
          {
            key: "bets" as Tab,
            label: roundBets ? i18n.t("gameInfo.tabs.totalBets") : i18n.t("liveBets.title"),
            icon: <span className="h-[7px] w-[7px] bg-emerald-400" />,
          },
        ]
      : []),
    { key: "info", label: i18n.t("gameInfo.tabs.info"), icon: <FiInfo className="text-[13px]" /> },
  ];

  return (
    <section className={`flex w-full flex-col gap-3 ${className}`} data-testid="game-details">
      <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-line px-1">
        <div role="tablist" className="flex gap-7">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={shown === t.key}
              onClick={() => setTab(t.key)}
              className={`${TAB} ${
                shown === t.key
                  ? "border-accent text-ink hover:border-accent"
                  : "border-transparent text-ink-muted hover:border-transparent hover:text-ink-soft"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {shown === "bets" && roundSummary}
      </div>
      {shown === "bets" ? roundBets ?? <LiveBets /> : <GameInfo game={game} ctx={info} />}
    </section>
  );
};

export default GameDetails;
