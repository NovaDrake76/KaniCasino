import { Fragment } from "react";
import PixelSymbol from "./PixelSymbol";
import Emphasis from "./Emphasis";
import { BARCODE, FACE_BACKGROUND, NAME_STYLE, lookVars } from "./ticketLook";
import type { KeyRow, TicketFace } from "./Scratch.types";

const KeyGrid = ({ rows }: { rows: KeyRow[] }) => (
  <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-2 bg-[var(--paper)] px-2.5 py-1.5 text-xs short:py-1 font-bold tabular-nums [@container(max-width:559px)]:grid-cols-[32px_minmax(0,1fr)_auto_32px_minmax(0,1fr)_auto]">
    {rows.map((row) => (
      <Fragment key={row.symbol}>
        <PixelSymbol name={row.symbol} size={32} />
        <span>{row.times}</span>
        <span className="text-right">{row.prize}</span>
      </Fragment>
    ))}
  </div>
);

const TicketInfo = ({ ticket }: { ticket: TicketFace }) => (
  <div className="flex min-w-0 flex-col gap-2 short:gap-1.5">
    <div className="text-[26px] leading-none text-white [@container(max-width:559px)]:text-[22px]" style={NAME_STYLE}>
      {ticket.name}
    </div>
    {ticket.rules.map((rule) => (
      <p key={rule} data-testid="ticket-rule" className="m-0 bg-[var(--paper)] px-2.5 py-1.5 text-[11.5px] font-semibold leading-snug">
        <Emphasis text={rule} strong="text-[var(--frame)]" />
      </p>
    ))}
    {ticket.key && <KeyGrid rows={ticket.key} />}
    <span className="self-end bg-[var(--ink)] px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums text-white">{ticket.price}</span>
  </div>
);

const TicketFoot = ({ ticket }: { ticket: TicketFace }) => (
  <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#b9b29c] bg-[var(--paper)] px-3 py-1.5 text-[11px] short:py-0.5 font-bold tabular-nums tracking-[0.14em]">
    {ticket.verify ? (
      <button
        onClick={ticket.verify}
        className="whitespace-nowrap rounded-none border-0 bg-transparent p-0 text-[11px] font-bold tracking-[0.14em] text-inherit underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
      >
        {ticket.serial}
      </button>
    ) : (
      <span className="whitespace-nowrap">{ticket.serial}</span>
    )}
    <span aria-hidden className="h-[22px] min-w-[60px] flex-[0_1_190px] short:h-[18px]" style={BARCODE} />
    <span className="whitespace-nowrap [@container(max-width:559px)]:hidden">{ticket.code}</span>
  </div>
);

// the ticket as a printed landscape card: the scratch zone, the character and the rules side by side, stacked when the
// ticket is narrow; it answers to its own width, since the board beside the panel is narrower than the screen
const TicketCard = ({ ticket, zone }: { ticket: TicketFace; zone: React.ReactNode }) => (
  <div
    data-testid="scratch-ticket"
    style={lookVars(ticket.look)}
    className="w-full select-none overflow-hidden rounded-md bg-[var(--paper)] text-[var(--ink)] shadow-[0_14px_40px_rgba(0,0,0,0.45)] [container-type:inline-size]"
  >
    <div className="flex items-center justify-between gap-2.5 bg-[var(--a)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white short:py-0.5">
      <span>{ticket.brand}</span>
      <span>{ticket.series}</span>
    </div>
    <div
      className="grid grid-cols-1 gap-3 p-3.5 short:p-2.5 [@container(min-width:560px)]:grid-cols-[300px_minmax(0,1fr)] [@container(min-width:700px)]:grid-cols-[300px_minmax(0,0.7fr)_minmax(0,1fr)]"
      style={{ background: FACE_BACKGROUND }}
    >
      <div className="w-full max-w-[300px] self-center justify-self-center">{zone}</div>
      <div className="hidden min-w-0 items-end justify-center [@container(min-width:700px)]:flex">
        <img src={ticket.look.art} alt="" draggable={false} className="max-h-[230px] w-auto max-w-full drop-shadow-[0_6px_0_rgba(0,0,0,0.18)]" />
      </div>
      <TicketInfo ticket={ticket} />
    </div>
    <TicketFoot ticket={ticket} />
  </div>
);

export default TicketCard;
