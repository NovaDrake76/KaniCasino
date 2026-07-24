import { AiFillCaretDown, AiFillCaretUp } from "react-icons/ai";
import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import PlayingCard, { SuitIcon } from "../Blackjack/PlayingCard";
import { isRedSuit, rankLabel, suitOf } from "../Blackjack/blackjackCards";
import { MAX_BET, pct } from "./hiloCards";
import { HiloViewProps } from "./Hilo.types";

const CardChip = ({ card, label }: { card: number; label?: string }) => (
  <div className="flex flex-col items-center gap-1 shrink-0">
    <div className={`w-9 h-12 rounded bg-white flex flex-col items-center justify-center leading-none ${isRedSuit(card) ? "text-red-600" : "text-[#1c1a31]"}`}>
      <span className="font-extrabold text-sm">{rankLabel(card)}</span>
      <SuitIcon suit={suitOf(card)} className="w-3.5" />
    </div>
    {label && <span className="text-[9px] text-accent-gold font-semibold uppercase">{label}</span>}
  </div>
);

const HiloView: React.FC<HiloViewProps> = ({
  isLogged,
  walletBalance,
  betInput,
  betValue,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  game,
  active,
  busy,
  start,
  guess,
  skip,
  cashout,
  openRoll,
}) => {
  const ended = !!game && (game.status === "cashed" || game.status === "busted");
  const controlsLocked = active;
  const currentPayout = game ? betValue * game.multiplier : betValue;

  return (
    <div className="w-screen flex flex-col items-center py-6 gap-6 px-4">
      <Title title="HiLo" />

      <div className="flex flex-col lg:flex-row w-full max-w-[1100px] bg-surface rounded-lg overflow-hidden border border-line">
        <div className="lg:w-[320px] flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-line p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>Bet Amount</span>
            <span><Monetary value={betValue} /></span>
          </div>
          <div className="flex">
            <input
              type="number"
              value={betInput}
              max={MAX_BET}
              onChange={(e) => setBetInput(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={normalizeBet}
              disabled={controlsLocked}
              className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm disabled:opacity-50"
            />
            <button onClick={halveBet} disabled={controlsLocked} className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line rounded-none text-sm font-semibold disabled:opacity-50">½</button>
            <button onClick={doubleBet} disabled={controlsLocked} className="px-3 bg-surface-raised hover:bg-surface-hover border border-line rounded-r rounded-l-none text-sm font-semibold disabled:opacity-50">2×</button>
          </div>

          {active ? (
            <button
              onClick={cashout}
              disabled={busy || !game?.canCashout}
              className="p-3 rounded bg-accent-gold hover:brightness-110 text-[#2a2100] font-bold w-full disabled:opacity-40 transition"
            >
              {game?.canCashout ? <>Cash Out <Monetary value={currentPayout} showFraction /></> : "Make a prediction"}
            </button>
          ) : (
            <button
              onClick={start}
              disabled={busy}
              className="p-3 rounded bg-green-500 hover:bg-green-400 text-[#10241A] font-bold w-full disabled:opacity-40 transition"
            >
              {isLogged ? "Bet" : "Sign in to play"}
            </button>
          )}

          <button
            onClick={skip}
            disabled={busy || !game?.canSkip}
            className="p-2.5 rounded-md bg-surface-raised border border-line-strong hover:bg-surface-hover text-ink-soft font-semibold w-full flex items-center justify-center gap-2 shadow-sm hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 transition"
          >
            Skip Card <span className="text-xs">»</span>
          </button>

          <button
            onClick={() => guess("hi")}
            disabled={busy || !active}
            className="flex items-center justify-between p-3 rounded-md bg-green-500/15 border border-green-500/50 hover:bg-green-500/25 hover:border-green-400 text-green-300 shadow-sm hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 transition text-sm font-bold"
          >
            <span className="flex items-center gap-2">Higher or Equal <AiFillCaretUp /></span>
            <span className="text-green-200/80">{game?.hiChance != null ? pct(game.hiChance) : "-"}</span>
          </button>
          <button
            onClick={() => guess("lo")}
            disabled={busy || !active}
            className="flex items-center justify-between p-3 rounded-md bg-red-500/15 border border-red-500/50 hover:bg-red-500/25 hover:border-red-400 text-red-300 shadow-sm hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 transition text-sm font-bold"
          >
            <span className="flex items-center gap-2">Lower or Equal <AiFillCaretDown /></span>
            <span className="text-red-200/80">{game?.loChance != null ? pct(game.loChance) : "-"}</span>
          </button>

          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-1">
            <span>Total Profit ({(game?.multiplier ?? 1).toFixed(2)}×)</span>
            <span className="text-accent-gold"><Monetary value={active && game ? currentPayout - betValue : 0} showFraction /></span>
          </div>

          {ended && game && (
            <button
              onClick={() => game.rollId && openRoll(game.rollId)}
              disabled={!game.rollId}
              className={`text-xs font-semibold text-center py-1 rounded ${game.status === "cashed" ? "text-green-400" : "text-red-400"} disabled:opacity-50`}
            >
              {game.status === "cashed" ? <>Won <Monetary value={game.payout} showFraction /> at {game.multiplier.toFixed(2)}×</> : "Busted! Verify roll"}
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center p-6 gap-6">
          <div className="flex items-center justify-center gap-6 sm:gap-14 w-full">
            <div className="hidden sm:flex flex-col items-center gap-2 opacity-40">
              <div className="w-16 h-24 rounded-lg border-2 border-line flex flex-col items-center justify-center text-ink-soft">
                <span className="font-extrabold text-xl">K</span>
                <AiFillCaretUp />
              </div>
              <span className="text-[10px] text-ink-muted font-semibold uppercase text-center w-24">King being<br />the highest</span>
            </div>

            <div className={busy ? "opacity-90" : ""}>
              <PlayingCard key={game ? game.cards.length : -1} card={game?.current} faceDown={!game} instant={!game} />
            </div>

            <div className="hidden sm:flex flex-col items-center gap-2 opacity-40">
              <div className="w-16 h-24 rounded-lg border-2 border-line flex flex-col items-center justify-center text-ink-soft">
                <span className="font-extrabold text-xl">A</span>
                <AiFillCaretDown />
              </div>
              <span className="text-[10px] text-ink-muted font-semibold uppercase text-center w-24">Ace being<br />the lowest</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-[520px]">
            <div className="bg-surface-nav border border-line rounded p-3">
              <div className="text-xs text-ink-muted font-semibold mb-1">Profit if Higher ({(game?.hiMultiplier ?? 0).toFixed(2)}×)</div>
              <div className="text-sm text-accent-gold font-semibold">
                <Monetary value={active && game?.hiMultiplier ? betValue * game.hiMultiplier - betValue : 0} showFraction />
              </div>
            </div>
            <div className="bg-surface-nav border border-line rounded p-3">
              <div className="text-xs text-ink-muted font-semibold mb-1">Profit if Lower ({(game?.loMultiplier ?? 0).toFixed(2)}×)</div>
              <div className="text-sm text-accent-gold font-semibold">
                <Monetary value={active && game?.loMultiplier ? betValue * game.loMultiplier - betValue : 0} showFraction />
              </div>
            </div>
          </div>

          {game && game.cards.length > 0 && (
            <div className="flex items-end gap-2 w-full max-w-[560px] overflow-x-auto pb-2">
              {game.cards.map((card, i) => (
                <CardChip key={i} card={card} label={i === 0 ? "Initial" : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-ink-muted text-xs max-w-[640px] text-center">
        Balance: <Monetary value={walletBalance} />. Predict if the next card is higher or lower, then cash out before you miss.
      </p>
    </div>
  );
};

export default HiloView;
