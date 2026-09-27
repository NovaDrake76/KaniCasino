import Monetary from "../../components/Monetary";

// the win, over the board it came from: the multiplier cashed at and what it paid
const CashoutCard = ({ multiplier, payout }: { multiplier: number; payout: number }) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div
      role="status"
      className="flex min-w-[9rem] flex-col items-center gap-2 border-[3px] border-green-500 bg-surface px-6 py-4 shadow-[0_0_28px_rgba(34,197,94,0.4)]"
    >
      <span className="text-3xl font-extrabold tabular-nums text-green-400">{multiplier.toFixed(2)}×</span>
      <span className="h-px w-full bg-line-strong" />
      <span className="text-base font-bold tabular-nums text-green-400">
        <Monetary value={payout} showFraction />
      </span>
    </div>
  </div>
);

export default CashoutCard;
