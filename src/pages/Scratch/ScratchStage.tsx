import GameButton from "../../components/game/GameButton";
import TicketCard from "./TicketCard";
import TicketZone from "./TicketZones";
import Catalogue from "./Catalogue";
import type { FinishedActions, ScratchViewProps, StackSummary as Summary } from "./Scratch.types";
import i18n from "../../i18n";

const RESULT_TONE = { won: "text-accent-gold", found: "text-ink", lost: "text-ink-soft" };
const WIDTH = "w-full max-w-[780px]";

// only where the panel sits under the ticket; beside it, from lg, the panel already counts the stack
const StackProgress = ({ counter, runningTotal }: { counter: string; runningTotal: string | null }) => (
  <div data-testid="stack-progress" className={`flex h-9 items-center justify-between text-xs font-semibold lg:hidden ${WIDTH}`}>
    <span className="text-ink-soft">{counter}</span>
    <span className="text-accent-gold">{runningTotal}</span>
  </div>
);

// the finished stack takes the progress line's place, so the ticket under it does not move
const StackSummary = ({ summary }: { summary: Summary }) => (
  <dl data-testid="stack-summary" className={`m-0 grid h-9 grid-cols-3 gap-1 text-center lg:hidden ${WIDTH}`}>
    {[
      [i18n.t("scratch.summaryCount"), summary.count],
      [i18n.t("scratch.summaryWon"), summary.won],
      [i18n.t("scratch.summaryBest"), summary.best],
    ].map(([term, value]) => (
      <div key={term} className="flex min-w-0 flex-col justify-center rounded bg-surface-nav px-1.5">
        <dt className="truncate text-[9px] font-semibold uppercase tracking-wider text-ink-muted">{term}</dt>
        <dd className="m-0 truncate text-xs font-bold text-accent-gold">{value}</dd>
      </div>
    ))}
  </dl>
);

const Finished = ({ finished }: { finished: FinishedActions }) => (
  <div
    data-testid="scratch-finished"
    aria-hidden={finished.shown ? undefined : true}
    className={`grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[auto_auto] ${finished.shown ? "" : "invisible"}`}
  >
    <GameButton onClick={finished.buyAgain.onClick} disabled={finished.buyAgain.disabled}>
      {finished.buyAgain.label}
    </GameButton>
    <GameButton onClick={finished.back.onClick} disabled={finished.back.disabled} variant="secondary">
      {finished.back.label}
    </GameButton>
  </div>
);

// the rack while nothing is in play, then one ticket at a time, sized to stay on a phone or a short laptop screen whole
const ScratchStage = ({ stage }: Pick<ScratchViewProps, "stage">) => {
  if (stage.kind === "catalogue") {
    return <Catalogue brand={stage.brand} selectedLabel={stage.selectedLabel} cards={stage.cards} select={stage.select} />;
  }
  return (
    <div className="flex w-full flex-col items-center gap-2.5 short:gap-2">
      {stage.summary ? <StackSummary summary={stage.summary} /> : stage.counter && <StackProgress counter={stage.counter} runningTotal={stage.runningTotal} />}
      <div className={WIDTH}>
        <TicketCard ticket={stage.ticket} zone={<TicketZone board={stage.ticket.board} />} />
      </div>
      <div data-testid="scratch-outcome" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 ${WIDTH}`}>
        <p
          data-testid="scratch-result"
          className={`m-0 flex min-h-[2.5rem] min-w-0 flex-1 basis-[240px] items-center justify-center text-center text-base font-bold leading-5 ${stage.result ? RESULT_TONE[stage.result.kind] : ""}`}
        >
          {stage.result?.text}
        </p>
        <Finished finished={stage.finished} />
      </div>
    </div>
  );
};

export default ScratchStage;
