import { FaCheck } from "react-icons/fa";
import Emphasis from "./Emphasis";
import { FACE_BACKGROUND, NAME_STYLE, lookVars } from "./ticketLook";
import type { CatalogueCard } from "./Scratch.types";
import type { TicketId } from "./scratchTickets";

// a small, faithful copy of the ticket: its strip, its colours, its character and its name
const MiniTicket = ({ card, brand }: { card: CatalogueCard; brand: string }) => (
  <span style={lookVars(card.look)} className="flex w-[132px] shrink-0 flex-col bg-[var(--paper)] sm:w-full">
    <span className="flex justify-between gap-1 bg-[var(--a)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="hidden truncate sm:inline">{brand}</span>
      <span>{card.series}</span>
    </span>
    <span className="relative block h-[118px] flex-1 overflow-hidden sm:h-[150px] sm:flex-none" style={{ background: FACE_BACKGROUND }}>
      <img
        src={card.look.art}
        alt=""
        draggable={false}
        className="absolute bottom-0 right-1 h-[92%] w-auto max-w-none drop-shadow-[0_4px_0_rgba(0,0,0,0.18)]"
      />
      <span className="absolute bottom-2 left-2 max-w-[78%] text-[17px] leading-[1.05] text-white sm:text-[20px]" style={NAME_STYLE}>
        {card.name}
      </span>
    </span>
  </span>
);

// the top prize leads, the price follows as the second figure, then the rule; the check is always laid out, so a card
// whose label wraps is that height whether or not it is selected
const CardDetails = ({ card, selectedLabel }: { card: CatalogueCard; selectedLabel: string }) => {
  const soft = card.selected ? "text-white/80" : "text-ink-soft";
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
      <span className="flex flex-wrap items-center justify-between gap-x-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${soft}`}>{card.topLabel}</span>
        <span
          aria-hidden={card.selected ? undefined : true}
          className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white ${card.selected ? "" : "invisible"}`}
        >
          <FaCheck className="text-[9px]" />
          {selectedLabel}
        </span>
      </span>
      <span data-testid="card-top" className="text-[22px] font-extrabold leading-none tabular-nums text-accent-gold">
        {card.top}
      </span>
      <span
        data-testid="card-price"
        className={`mt-1 self-start px-2 py-0.5 text-sm font-extrabold tabular-nums text-white ${card.selected ? "bg-black/25" : "bg-surface-raised"}`}
      >
        {card.price}
      </span>
      <span className="text-xs font-medium leading-snug text-white">
        <Emphasis text={card.rule} strong="font-bold" />
      </span>
    </span>
  );
};

interface CatalogueProps {
  brand: string;
  selectedLabel: string;
  cards: CatalogueCard[];
  select: (id: TicketId) => void;
}

// the rack of tickets: a wrapping grid that takes a fourth and fifth ticket as they come, one card per row on a phone
const Catalogue = ({ brand, selectedLabel, cards, select }: CatalogueProps) => (
  <div data-testid="scratch-catalogue" className="grid w-full max-w-[780px] grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
    {cards.map((card) => (
      <button
        key={card.id}
        type="button"
        data-testid={`ticket-card-${card.id}`}
        aria-pressed={card.selected}
        onClick={() => select(card.id)}
        className={`flex min-w-0 flex-row overflow-hidden rounded-md text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:flex-col ${
          card.selected ? "bg-accent" : "bg-surface-nav hover:bg-surface-hover"
        }`}
      >
        <MiniTicket card={card} brand={brand} />
        <CardDetails card={card} selectedLabel={selectedLabel} />
      </button>
    ))}
  </div>
);

export default Catalogue;
