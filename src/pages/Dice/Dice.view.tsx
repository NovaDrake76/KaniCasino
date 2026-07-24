import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import { AUTO_COUNTS } from "./Dice.services";
import { MAX_BET } from "./diceControls";
import { DiceViewProps } from "./Dice.types";

const TICKS = [0, 25, 50, 75, 100];
const GREEN = "#22C55E";
const RED = "#EF4444";

const DiceView: React.FC<DiceViewProps> = ({
  isLogged,
  walletBalance,
  betInput,
  betValue,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  target,
  direction,
  controls,
  profitOnWin,
  changeWinChance,
  changeMultiplier,
  toggleDirection,
  dragging,
  trackHandlers,
  mode,
  setMode,
  autoCount,
  setAutoCount,
  autoRunning,
  autoLeft,
  startAuto,
  stopAuto,
  rolling,
  roll,
  last,
  history,
  openRoll,
}) => {
  const targetPct = target / 100;
  const markerPct = last ? last.resultValue : 50;
  // green fills the winning side: right of the target for "over", left for "under"
  const winGradient =
    direction === "over"
      ? `linear-gradient(to right, ${RED} 0%, ${RED} ${targetPct}%, ${GREEN} ${targetPct}%, ${GREEN} 100%)`
      : `linear-gradient(to right, ${GREEN} 0%, ${GREEN} ${targetPct}%, ${RED} ${targetPct}%, ${RED} 100%)`;

  return (
    <div className="w-screen flex flex-col items-center py-6 gap-6 px-4">
      <Title title="Dice" />

      <div className="flex flex-col lg:flex-row w-full max-w-[1100px] bg-surface rounded-lg overflow-hidden border border-line">
        <div className="lg:w-[320px] flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-line p-5">
          <div className="flex bg-surface-nav rounded p-1 text-sm font-semibold">
            <button
              onClick={() => setMode("manual")}
              className={`flex-1 py-1.5 rounded ${mode === "manual" ? "bg-surface-raised text-white" : "text-ink-muted"}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode("auto")}
              className={`flex-1 py-1.5 rounded ${mode === "auto" ? "bg-surface-raised text-white" : "text-ink-muted"}`}
            >
              Auto
            </button>
          </div>

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
              disabled={autoRunning}
              className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm disabled:opacity-50"
            />
            <button
              onClick={halveBet}
              disabled={autoRunning}
              className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line rounded-none text-sm font-semibold disabled:opacity-50"
            >
              ½
            </button>
            <button
              onClick={doubleBet}
              disabled={autoRunning}
              className="px-3 bg-surface-raised hover:bg-surface-hover border border-line rounded-r rounded-l-none text-sm font-semibold disabled:opacity-50"
            >
              2×
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-1">
            <span>Profit on Win</span>
            <span className="text-accent-gold"><Monetary value={profitOnWin} showFraction /></span>
          </div>

          {mode === "auto" && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-xs font-semibold text-ink-muted">Number of Bets</span>
              <div className="grid grid-cols-4 gap-1">
                {AUTO_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setAutoCount(n)}
                    disabled={autoRunning}
                    className={`py-1.5 rounded text-sm font-semibold ${autoCount === n ? "bg-surface-raised text-white" : "bg-surface-nav text-ink-muted"} disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "manual" ? (
            <button
              onClick={roll}
              disabled={rolling}
              className="p-3 rounded bg-green-500 hover:bg-green-400 text-[#10241A] font-bold w-full mt-2 disabled:opacity-40 transition-colors"
            >
              {isLogged ? "Roll Dice" : "Sign in to play"}
            </button>
          ) : (
            <button
              onClick={autoRunning ? stopAuto : startAuto}
              className={`p-3 rounded font-bold w-full mt-2 transition-colors ${autoRunning ? "bg-red-500 hover:bg-red-400 text-white" : "bg-green-500 hover:bg-green-400 text-[#10241A]"}`}
            >
              {autoRunning ? `Stop (${autoLeft} left)` : isLogged ? `Start ${autoCount} Bets` : "Sign in to play"}
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col p-6 gap-6">
          <div className="flex items-center justify-end gap-2 h-8 overflow-hidden">
            {history.map((h) => (
              <button
                key={h.key}
                onClick={() => h.rollId && openRoll(h.rollId)}
                className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${h.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
              >
                {h.resultValue.toFixed(2)}
              </button>
            ))}
          </div>

          <div className="px-2 pt-14 pb-1">
            <div className="flex justify-between text-xs text-ink-muted mb-2 font-semibold px-3">
              {TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="bg-surface-deep rounded-full p-2.5 border border-line shadow-inner">
              <div
                {...trackHandlers}
                className="relative h-3.5 rounded-full cursor-pointer touch-none select-none"
                style={{ background: winGradient }}
              >
                {last && (
                  <div
                    className={`absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center pointer-events-none ${dragging ? "" : "transition-all duration-500 ease-out"}`}
                    style={{ left: `${markerPct}%` }}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg rotate-45 flex items-center justify-center shadow-lg ${last.won ? "bg-green-500" : "bg-red-500"}`}
                    >
                      <span className="-rotate-45 text-white font-extrabold text-xs">
                        {last.resultValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-8 bg-accent rounded shadow-md border-2 border-white/80 ${dragging ? "cursor-grabbing scale-110" : "cursor-grab"} transition-transform`}
                  style={{ left: `${targetPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">Multiplier</span>
              <input
                type="number"
                step="0.0001"
                value={controls.multiplier}
                onChange={(e) => changeMultiplier(Number(e.target.value))}
                disabled={autoRunning}
                className="p-2 bg-surface-nav border border-line rounded text-sm disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">
                Roll {direction === "over" ? "Over" : "Under"}
              </span>
              <button
                onClick={toggleDirection}
                disabled={autoRunning}
                className="p-2 bg-surface-nav border border-line rounded text-sm flex items-center justify-between hover:bg-surface-raised disabled:opacity-50"
              >
                <span>{(target / 100).toFixed(2)}</span>
                <span className="text-ink-muted text-xs">⇄</span>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">Win Chance</span>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={Number(controls.winChance.toFixed(2))}
                  onChange={(e) => changeWinChance(Number(e.target.value))}
                  disabled={autoRunning}
                  className="p-2 pr-7 bg-surface-nav border border-line rounded text-sm w-full disabled:opacity-50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-xs">%</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <p className="text-ink-muted text-xs max-w-[640px] text-center">
        Balance: <Monetary value={walletBalance} />. Every roll is provably fair. 99% RTP, 1% house edge.
      </p>
    </div>
  );
};

export default DiceView;
