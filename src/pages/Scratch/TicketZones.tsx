import ScratchCoating from "./ScratchCoating";
import PixelSymbol from "./PixelSymbol";
import { SPOT_BRUSH, SPOT_CLEAR, TICKET_CLEAR, ZONE_BRUSH } from "./scratchSurface";
import { NAME_STYLE } from "./ticketLook";
import type { Board, CellMark, NineBoard, PocketBoard, TreasureBoard, TreasureSpot, ZoneCoating } from "./Scratch.types";

const MARK: Record<CellMark, string> = {
  plain: "bg-[var(--cell)]",
  win: "bg-accent-gold",
  dim: "bg-[var(--cell)] opacity-40",
};

// covered and missed spots are the dark card under the foil; a scratched one is the bright find, ringed in gold
const SPOT_MARK: Record<TreasureSpot["mark"], string> = {
  covered: "bg-[#2a1c05] text-[#ffe9a8]",
  open: "bg-[#fff3c4] text-[var(--ink)] shadow-[inset_0_0_0_3px_#FFCC00]",
  kept: "bg-[#fff3c4] text-[var(--ink)] shadow-[inset_0_0_0_3px_#FFCC00]",
  missed: "bg-[#2a1c05] text-[#ffe9a8] opacity-50",
};

// the printed frame round the scratch zone; the one coloured border on the page, and square like the print
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative border-4 border-[var(--frame)] bg-[var(--paper)] p-1.5" style={{ touchAction: "none" }}>
    {children}
  </div>
);

const Coating = ({ coating }: { coating: ZoneCoating }) => (
  <ScratchCoating
    key={coating.key}
    label={coating.label}
    active={coating.active}
    state={coating.state}
    brush={ZONE_BRUSH}
    threshold={TICKET_CLEAR}
    onRub={coating.onRub}
    onComplete={coating.onComplete}
  />
);

const PocketZone = ({ board }: { board: PocketBoard }) => (
  <Frame>
    <div className="grid grid-cols-3 gap-1">
      {board.cells.map((cell, i) => (
        <div
          key={i}
          data-testid="scratch-cell"
          data-mark={cell.mark}
          className={`flex aspect-square items-center justify-center transition-opacity duration-300 ${MARK[cell.mark]}`}
        >
          <PixelSymbol name={cell.symbol} size={64} />
        </div>
      ))}
    </div>
    <Coating coating={board.coating} />
  </Frame>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <small className="text-[8.5px] font-bold uppercase tracking-[0.08em] opacity-70">{children}</small>
);

const NineZone = ({ board }: { board: NineBoard }) => (
  <Frame>
    <div className="mb-1.5 grid grid-cols-3 gap-1">
      {board.lucky.map((symbol, i) => (
        <div key={i} data-testid="lucky-symbol" className="flex flex-col items-center justify-center gap-0.5 bg-[#e6e0ff] py-1.5">
          <Label>{board.luckyLabel}</Label>
          <PixelSymbol name={symbol} size={32} />
        </div>
      ))}
      <div className="flex flex-col items-center justify-center gap-0.5 bg-[var(--ink)] py-1.5 text-accent-gold">
        <Label>{board.multiplierLabel}</Label>
        <span className="text-[22px] leading-8" style={{ fontFamily: NAME_STYLE.fontFamily }}>
          {board.multiplier}
        </span>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-1">
      {board.spots.map((spot, i) => (
        <div
          key={i}
          data-testid="scratch-cell"
          data-mark={spot.mark}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-extrabold tabular-nums transition-opacity duration-300 ${MARK[spot.mark]}`}
        >
          <PixelSymbol name={spot.symbol} size={32} />
          <span>{spot.prize}</span>
        </div>
      ))}
    </div>
    <Coating coating={board.coating} />
  </Frame>
);

const Spot = ({ spot, emptyLabel }: { spot: TreasureSpot; emptyLabel: string }) => (
  <div
    data-testid="treasure-spot"
    data-mark={spot.mark}
    className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold tabular-nums transition-opacity duration-300 ${SPOT_MARK[spot.mark]}`}
  >
    {spot.find &&
      (spot.find.symbol ? (
        <>
          <PixelSymbol name={spot.find.symbol} size={64} />
          <span>{spot.find.amount}</span>
        </>
      ) : (
        <span className="font-semibold">{emptyLabel}</span>
      ))}
    <ScratchCoating
      key={spot.coating.key}
      label=""
      testId="spot-coating"
      active={spot.coating.active}
      state={spot.coating.state}
      brush={SPOT_BRUSH}
      threshold={SPOT_CLEAR}
      onStart={spot.coating.onStart}
      onRub={spot.coating.onRub}
      onComplete={spot.coating.onComplete}
    />
  </div>
);

const TreasureZone = ({ board }: { board: TreasureBoard }) => (
  <Frame>
    <div className="grid grid-cols-3 gap-1">
      {board.spots.map((spot) => (
        <Spot key={spot.cell} spot={spot} emptyLabel={board.emptyLabel} />
      ))}
    </div>
  </Frame>
);

const TicketZone = ({ board }: { board: Board }) =>
  board.kind === "pocket" ? <PocketZone board={board} /> : board.kind === "nine" ? <NineZone board={board} /> : <TreasureZone board={board} />;

export default TicketZone;
