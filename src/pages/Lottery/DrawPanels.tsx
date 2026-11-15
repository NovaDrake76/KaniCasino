import { FiPlay } from "react-icons/fi";
import Ball, { BallRow } from "./Ball";
import type { LastDrawView, LotteryViewProps, MyTicketRow } from "./Lottery.types";
import i18n from "../../i18n";

const CARD = "flex min-w-0 flex-col gap-4 rounded-lg bg-surface p-5";

export const TicketRows = ({ rows }: { rows: MyTicketRow[] }) => (
  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
    {rows.map((row) => (
      <li key={row.key} data-testid="result-row" className="flex items-center justify-between gap-3 rounded bg-surface-nav px-3 py-2">
        <BallRow balls={row.balls} size="sm" />
        <span className={`text-sm font-semibold tabular-nums ${row.won ? "text-accent-gold" : "text-ink-muted"}`}>{row.prize}</span>
      </li>
    ))}
  </ul>
);

export const MyTickets = ({ tickets }: { tickets: NonNullable<LotteryViewProps["myTickets"]> }) => (
  <section data-testid="my-tickets" className={CARD}>
    <h2 className="m-0 text-base font-bold">{tickets.title}</h2>
    {tickets.rows.length ? (
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
        {tickets.rows.map((row) => (
          <li key={row.key} data-testid="my-ticket" className="flex justify-center rounded bg-surface-nav px-2 py-2">
            <BallRow balls={row.balls} size="sm" />
          </li>
        ))}
      </ul>
    ) : (
      <p className="m-0 text-sm text-ink-muted">{tickets.empty}</p>
    )}
  </section>
);

const LastResult = ({ draw }: { draw: LastDrawView }) => (
  <>
    <div className="flex gap-2">
      {draw.balls.map((ball, i) => (
        <Ball key={i} n={ball.n} tone={ball.tone} size="lg" />
      ))}
    </div>
    <p data-testid="jackpot-line" className="m-0 text-sm font-semibold text-ink">
      {draw.jackpotLine}
    </p>
    <dl className="m-0 grid grid-cols-2 gap-2">
      {draw.tiers.map((tier) => (
        <div key={tier.label} className="flex flex-col rounded bg-surface-nav px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{tier.label}</dt>
          <dd className="m-0 text-sm font-bold">{tier.value}</dd>
        </div>
      ))}
    </dl>
    {draw.mine.length > 0 && (
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-xs font-semibold text-ink-muted">{i18n.t("lottery.yourTickets")}</h3>
        <TicketRows rows={draw.mine} />
        {draw.total && (
          <p data-testid="last-total" className="m-0 text-sm font-bold text-accent-gold">
            {draw.total}
          </p>
        )}
      </div>
    )}
  </>
);

const Watching = ({ text }: { text: string }) => (
  <p data-testid="last-watching" aria-live="polite" className="m-0 rounded bg-surface-nav px-3 py-8 text-center text-sm font-semibold text-ink-soft">
    {text}
  </p>
);

const WatchButton = ({ watch }: { watch: LastDrawView["watch"] }) => (
  <button
    type="button"
    onClick={watch.onClick}
    disabled={watch.disabled}
    className="flex min-h-[36px] items-center gap-2 self-start rounded border-0 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink transition-colors enabled:hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light disabled:opacity-40"
  >
    <FiPlay aria-hidden />
    {watch.label}
  </button>
);

export const LastDraw = ({ draw }: { draw: LastDrawView | null }) => (
  <section data-testid="last-draw" className={CARD}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="m-0 text-base font-bold">{i18n.t("lottery.lastDraw")}</h2>
      {draw && (
        <span className="text-xs text-ink-muted">
          {draw.title} · {draw.date}
        </span>
      )}
    </div>
    {draw ? (
      <>
        {draw.watching ? <Watching text={draw.watching} /> : <LastResult draw={draw} />}
        <WatchButton watch={draw.watch} />
      </>
    ) : (
      <p className="m-0 text-sm text-ink-muted">{i18n.t("lottery.noDrawYet")}</p>
    )}
  </section>
);
