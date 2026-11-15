import type { Pip, TicketProgress } from "./Scratch.types";

const PIP_TONE: Record<Pip["mark"], string> = {
  unscratched: "border border-ink-muted bg-transparent",
  lost: "bg-ink-faint/50",
  found: "bg-ink-soft",
  won: "bg-accent-gold",
};

// one square per ticket or pick; the current one carries the accent bar under it
const Pips = ({ label, items }: { label: string; items: Pip[] }) => (
  <div data-testid="ticket-pips" role="img" aria-label={label} className="flex flex-wrap gap-1.5">
    {items.map((pip, i) => (
      <span key={i} data-mark={pip.mark} data-current={pip.current || undefined} className="flex flex-col gap-0.5">
        <span className={`block h-3.5 w-3.5 ${PIP_TONE[pip.mark]}`} />
        <span className={`block h-0.5 w-3.5 ${pip.current ? "bg-accent" : "bg-transparent"}`} />
      </span>
    ))}
  </div>
);

// the side panel while a ticket is in play or done: the ticket, how far it has got and what it has paid, nothing printed twice
const ProgressPanel = ({ progress }: { progress: TicketProgress }) => (
  <div data-tour="bet-input" className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-ink-muted">{progress.label}</span>
    <div data-testid="ticket-progress" className="flex flex-col gap-2 rounded bg-surface-nav p-3 short:gap-1.5 short:p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-white">{progress.name}</span>
        <span className="shrink-0 font-extrabold tabular-nums text-accent-gold">{progress.price}</span>
      </div>
      {progress.pips && <Pips label={progress.pips.label} items={progress.pips.items} />}
      {progress.lines.map((line) => (
        <div key={line.label} className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink-muted">{line.label}</span>
          <span className="min-w-0 truncate font-bold tabular-nums text-accent-gold">{line.value}</span>
        </div>
      ))}
      {Array.from({ length: progress.heldLines }, (_, i) => (
        <div key={`held-${i}`} aria-hidden className="text-sm">
          &nbsp;
        </div>
      ))}
    </div>
  </div>
);

export default ProgressPanel;
