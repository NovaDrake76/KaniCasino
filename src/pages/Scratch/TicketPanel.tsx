import { Fragment } from "react";
import PixelSymbol from "./PixelSymbol";
import Emphasis from "./Emphasis";
import type { PanelKey, TicketDetails } from "./Scratch.types";

const PrizeKey = ({ prizeKey, testId }: { prizeKey: PanelKey; testId?: string }) =>
  prizeKey.kind === "rows" ? (
    <div data-testid={testId} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-2 text-sm">
      {prizeKey.rows.map((row) => (
        <Fragment key={row.symbol}>
          <PixelSymbol name={row.symbol} size={32} />
          <span className="text-ink-muted">{row.times}</span>
          <span className="text-right font-semibold tabular-nums text-accent-gold">{row.prize}</span>
        </Fragment>
      ))}
    </div>
  ) : (
    <div data-testid={testId} className="flex flex-col gap-2">
      {prizeKey.groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{group.label}</span>
          <div className="flex flex-wrap gap-1">
            {group.values.map((value) => (
              <span key={value} className="rounded bg-surface-raised px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-gold">
                {value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

const Details = ({ details, shown }: { details: TicketDetails; shown: boolean }) => (
  <div
    data-testid={shown ? "ticket-details" : undefined}
    aria-hidden={shown ? undefined : true}
    className={`col-start-1 row-start-1 flex flex-col gap-2 rounded bg-surface-nav p-3 short:gap-1.5 short:p-2.5 ${shown ? "" : "invisible"}`}
  >
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-bold text-white">{details.name}</span>
      <span className="shrink-0 font-extrabold tabular-nums text-accent-gold">{details.price}</span>
    </div>
    {details.rules.map((rule) => (
      <p key={rule} className="m-0 text-xs leading-snug text-ink-soft">
        <Emphasis text={rule} strong="font-semibold text-white" />
      </p>
    ))}
    <PrizeKey prizeKey={details.key} testId={shown ? "prize-key" : undefined} />
  </div>
);

// the side panel's account of the ticket picked in the rack: its name, its rule and everything it can pay; the other
// tickets sit unseen in the same cell, so the box is always the tallest one's height and picking another moves nothing
const TicketPanel = ({ details, reserve }: { details: TicketDetails; reserve: TicketDetails[] }) => (
  <div data-tour="bet-input" className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-ink-muted">{details.label}</span>
    <div className="grid">
      <Details details={details} shown />
      {reserve.map((other) => (
        <Details key={other.id} details={other} shown={false} />
      ))}
    </div>
  </div>
);

export default TicketPanel;
