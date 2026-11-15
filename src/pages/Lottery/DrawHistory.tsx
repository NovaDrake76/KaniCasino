import { FiChevronDown, FiShield } from "react-icons/fi";
import { BallRow } from "./Ball";
import { TicketRows } from "./DrawPanels";
import type { DrawDetails, LotteryViewProps } from "./Lottery.types";
import i18n from "../../i18n";

const PAGER = "rounded border-0 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink enabled:hover:bg-surface-hover focus:outline-none disabled:opacity-40";

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
    <code className="break-all text-xs text-ink-soft">{value}</code>
  </div>
);

// the commitment, the revealed seed, and a check that rebuilds the numbers in the browser
const Verify = ({ details }: { details: DrawDetails }) => (
  <div data-testid="draw-details" className="flex flex-col gap-3 rounded bg-surface-nav p-3">
    <Detail label={i18n.t("lottery.seedHash")} value={details.seedHash} />
    <Detail label={i18n.t("lottery.serverSeed")} value={details.serverSeed} />
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={details.check.run}
        disabled={details.check.running}
        className="flex items-center gap-2 rounded border-0 bg-accent px-3 py-1.5 text-xs font-bold text-white enabled:hover:bg-accent-light focus:outline-none disabled:opacity-50"
      >
        <FiShield />
        {details.check.running ? i18n.t("lottery.verifying") : i18n.t("lottery.verify")}
      </button>
      {details.check.text && (
        <span data-testid="check-result" className={`text-xs font-semibold ${details.check.ok ? "text-emerald-400" : "text-red-400"}`}>
          {details.check.text}
        </span>
      )}
    </div>
    {details.mine.length > 0 && (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-muted">{i18n.t("lottery.yourTickets")}</span>
        <TicketRows rows={details.mine} />
      </div>
    )}
  </div>
);

const DrawHistory = ({ history }: { history: LotteryViewProps["history"] }) => (
  <section data-testid="draw-history" className="flex w-full min-w-0 flex-col gap-3 rounded-lg bg-surface p-5">
    <h2 className="m-0 text-base font-bold">{i18n.t("lottery.history")}</h2>
    {history.empty && <p className="m-0 text-sm text-ink-muted">{history.empty}</p>}
    <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
      {history.rows.map((row) => (
        <li key={row.number} data-testid="history-row" className="flex flex-col gap-2 py-2">
          <button
            type="button"
            onClick={row.toggle}
            aria-expanded={row.open}
            className="flex w-full min-w-0 items-center gap-3 rounded-none border-0 bg-transparent px-0 py-1 text-left hover:border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
          >
            <span className="w-14 shrink-0 text-sm font-bold">#{row.number}</span>
            <span className="hidden w-16 shrink-0 text-xs text-ink-muted sm:block">{row.date}</span>
            <BallRow balls={row.balls} size="sm" />
            <span className={`ml-auto text-sm font-semibold tabular-nums ${row.won ? "text-accent-gold" : "text-ink-soft"}`}>{row.jackpot}</span>
            <span className={`hidden w-24 shrink-0 text-right text-xs font-semibold sm:block ${row.won ? "text-accent-gold" : "text-ink-muted"}`}>{row.outcome}</span>
            <FiChevronDown className={`shrink-0 text-ink-muted transition-transform ${row.open ? "rotate-180" : ""}`} />
          </button>
          {row.details && <Verify details={row.details} />}
        </li>
      ))}
    </ul>
    {history.pager && (
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={history.pager.newer || undefined} disabled={!history.pager.newer} className={PAGER}>
          {i18n.t("lottery.newer")}
        </button>
        <span className="text-xs text-ink-muted">{history.pager.label}</span>
        <button type="button" onClick={history.pager.older || undefined} disabled={!history.pager.older} className={PAGER}>
          {i18n.t("lottery.older")}
        </button>
      </div>
    )}
  </section>
);

export default DrawHistory;
