import { Fragment } from "react";
import Ball from "./Ball";
import Drum from "./Drum";
import type { PrizeRow, StageView } from "./Lottery.types";
import i18n from "../../i18n";

const Jackpot = ({ stage }: { stage: StageView }) => (
  <div className="flex flex-col items-center gap-1 text-center md:col-span-2">
    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">{i18n.t("lottery.jackpot")}</span>
    <span data-testid="jackpot" className="text-5xl font-extrabold leading-none tabular-nums text-accent-gold sm:text-6xl short:text-4xl">
      {stage.ready ? stage.jackpot : "-"}
    </span>
    {stage.rolling && (
      <span data-testid="rolling" className="mt-1.5 rounded bg-surface-raised px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-gold">
        {stage.rolling}
      </span>
    )}
  </div>
);

const Tray = ({ stage }: { stage: StageView }) => (
  <ol data-testid="tray" aria-label={stage.trayLabel} aria-live="polite" className="m-0 flex list-none gap-2.5 rounded-md bg-surface-nav px-3.5 py-2.5 short:py-2">
    {stage.tray.map((ball, i) => (
      <li key={i} data-testid="tray-slot" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#100E1F] short:h-10 short:w-10">
        {ball.n != null && <Ball n={ball.n} tone={ball.tone} size="lg" look="drum" drop={stage.drop} />}
      </li>
    ))}
  </ol>
);

const Clock = ({ stage }: { stage: StageView }) => (
  <div className="mt-3 flex flex-col items-center gap-0.5 short:mt-1.5">
    {stage.countdown && (
      <>
        <span data-testid="clock-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {stage.clockLabel}
        </span>
        <span data-testid="countdown" className="text-2xl font-extrabold leading-tight tabular-nums text-ink">
          {stage.countdown}
        </span>
      </>
    )}
    <p
      data-testid="stage-status"
      aria-live="polite"
      className={`m-0 min-h-[20px] text-center text-[13px] ${stage.won ? "font-extrabold text-accent-gold" : "font-semibold text-ink-soft"}`}
    >
      {stage.status}
    </p>
  </div>
);

const Machine = ({ stage }: { stage: StageView }) => (
  <div className="flex min-w-0 flex-col items-center">
    <div className="relative flex w-full justify-center">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[440px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,#2C2850,transparent)] lg:short:w-[340px]" />
      <Drum numbers={stage.drum} speed={stage.speed} label={stage.drumLabel} />
    </div>
    <div aria-hidden className="h-4 w-[34px] bg-line-strong short:h-2.5" />
    <Tray stage={stage} />
    <Clock stage={stage} />
  </div>
);

const Card = ({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) => (
  <section data-testid={testId} className="flex min-w-0 flex-col gap-2 rounded-md bg-surface-nav p-3">
    <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{title}</h3>
    {children}
  </section>
);

const Prizes = ({ prizes }: { prizes: PrizeRow[] }) => (
  <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-2.5 gap-y-1.5 tabular-nums">
    {prizes.map((row) => (
      <Fragment key={row.label}>
        <dt className="text-sm font-semibold text-ink-soft">{row.label}</dt>
        <dd className={`m-0 text-right text-sm font-extrabold ${row.top ? "text-accent-gold" : "text-ink"}`}>{row.value}</dd>
      </Fragment>
    ))}
  </dl>
);

// the draw machine: the pot over the drum, the tray and clock under it, the player's pick and the prizes beside it
const Stage = ({ stage }: { stage: StageView }) => (
  <div data-testid="lottery-stage" className="isolate grid w-full grid-cols-1 items-center gap-x-6 gap-y-4 short:gap-y-2 md:grid-cols-[minmax(0,1fr)_220px]">
    <Jackpot stage={stage} />
    <Machine stage={stage} />
    <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-1">
      <Card title={i18n.t("lottery.yourPick")} testId="your-pick">
        <div className="flex gap-2">
          {stage.pick.map((ball, i) => (
            <Ball key={i} n={ball.n} tone={ball.tone} size="lg" look="drum" />
          ))}
        </div>
      </Card>
      <Card title={i18n.t("lottery.prizes")} testId="prizes">
        <Prizes prizes={stage.prizes} />
      </Card>
    </div>
  </div>
);

export default Stage;
