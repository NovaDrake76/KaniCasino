import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import { AUTO_COUNTS } from "./Mines.services";
import { MAX_BET, TILES, mineOptions } from "./minesGrid";
import { MinesViewProps } from "./Mines.types";

const Diamond = () => (
  <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 drop-shadow">
    <defs>
      <linearGradient id="mines-gem" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7bffbe" />
        <stop offset="1" stopColor="#17c964" />
      </linearGradient>
    </defs>
    <g stroke="#0c6b39" strokeWidth="0.5" strokeLinejoin="round">
      <polygon points="6,3 18,3 22,9 12,22 2,9" fill="url(#mines-gem)" />
      <path d="M2 9h20M6 3l2 6-2 0M18 3l-2 6 2 0M8 9l4 13 4-13" fill="none" opacity="0.5" />
    </g>
  </svg>
);

const Bomb = ({ hit }: { hit: boolean }) => (
  <svg viewBox="0 0 24 24" className={`w-3/5 h-3/5 ${hit ? "" : "opacity-80"}`}>
    <circle cx="11" cy="14" r="7" fill="#161421" />
    <circle cx="8.5" cy="11.5" r="2" fill="#3a3550" />
    <rect x="12" y="4" width="3" height="4" rx="1" fill="#5a5470" transform="rotate(-20 13 6)" />
    <path d="M15 5c3-2 4 1 6-1" fill="none" stroke="#8a8398" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="21" cy="4" r="1.6" fill={hit ? "#f97316" : "#eab308"} />
  </svg>
);

const MinesView: React.FC<MinesViewProps> = ({
  isLogged,
  walletBalance,
  betInput,
  betValue,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  mineCount,
  changeMineCount,
  gemsCount,
  game,
  active,
  busy,
  gems,
  currentPayout,
  history,
  mode,
  setMode,
  autoCount,
  setAutoCount,
  autoPicks,
  setAutoPicks,
  autoRunning,
  autoLeft,
  startAuto,
  stopAuto,
  start,
  reveal,
  cashout,
  randomTile,
  openRoll,
}) => {
  const ended = !!game && game.status !== "active";
  const controlsLocked = active || autoRunning;

  const tileFace = (tile: number) => {
    const isRevealed = game?.revealed.includes(tile);
    const isMine = ended && game?.mineSet?.includes(tile);
    const isBust = game?.bustTile === tile;
    if (isMine) return { kind: "mine" as const, hit: isBust };
    if (isRevealed) return { kind: "gem" as const, hit: false };
    return { kind: ended ? ("faint" as const) : ("covered" as const), hit: false };
  };

  return (
    <div className="w-screen flex flex-col items-center py-6 gap-6 px-4">
      <Title title="Mines" />

      <div className="flex flex-col lg:flex-row w-full max-w-[1000px] bg-surface rounded-lg overflow-hidden border border-line">
        <div className="lg:w-[300px] flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-line p-5">
          <div className="flex bg-surface-nav rounded p-1 text-sm font-semibold">
            <button
              onClick={() => setMode("manual")}
              disabled={autoRunning}
              className={`flex-1 py-1.5 rounded ${mode === "manual" ? "bg-surface-raised text-white" : "text-ink-muted"}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode("auto")}
              disabled={active}
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
              disabled={controlsLocked}
              className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm disabled:opacity-50"
            />
            <button onClick={halveBet} disabled={controlsLocked} className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line rounded-none text-sm font-semibold disabled:opacity-50">½</button>
            <button onClick={doubleBet} disabled={controlsLocked} className="px-3 bg-surface-raised hover:bg-surface-hover border border-line rounded-r rounded-l-none text-sm font-semibold disabled:opacity-50">2×</button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">Mines</span>
              <select
                value={mineCount}
                onChange={(e) => changeMineCount(Number(e.target.value))}
                disabled={controlsLocked}
                className="p-2 bg-surface-nav border border-line rounded text-sm disabled:opacity-50"
              >
                {mineOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">Gems</span>
              <div className="p-2 bg-surface-nav border border-line rounded text-sm text-ink-soft">{gemsCount}</div>
            </div>
          </div>

          {mode === "auto" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-muted">Tiles per round</span>
              <input
                type="number"
                min={1}
                max={gemsCount}
                value={autoPicks}
                onChange={(e) => setAutoPicks(Math.min(Math.max(1, Math.floor(Number(e.target.value)) || 1), gemsCount))}
                disabled={autoRunning}
                className="p-2 bg-surface-nav border border-line rounded text-sm disabled:opacity-50"
              />
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
            active ? (
              <>
                <button
                  onClick={cashout}
                  disabled={busy || gems === 0}
                  className="p-3 rounded bg-accent-gold hover:brightness-110 text-[#2a2100] font-bold w-full disabled:opacity-40 transition"
                >
                  {gems > 0 ? <>Cash Out <Monetary value={currentPayout} showFraction /></> : "Reveal a tile"}
                </button>
                <button
                  onClick={randomTile}
                  disabled={busy}
                  className="p-2.5 rounded bg-surface-raised hover:bg-surface-hover text-ink-soft font-semibold w-full disabled:opacity-40 transition"
                >
                  Random Tile
                </button>
              </>
            ) : (
              <button
                onClick={start}
                disabled={busy}
                className="p-3 rounded bg-green-500 hover:bg-green-400 text-[#10241A] font-bold w-full disabled:opacity-40 transition"
              >
                {isLogged ? "Bet" : "Sign in to play"}
              </button>
            )
          ) : (
            <button
              onClick={autoRunning ? stopAuto : startAuto}
              className={`p-3 rounded font-bold w-full transition ${autoRunning ? "bg-red-500 hover:bg-red-400 text-white" : "bg-green-500 hover:bg-green-400 text-[#10241A]"}`}
            >
              {autoRunning ? `Stop (${autoLeft} left)` : isLogged ? `Start ${autoCount} Bets` : "Sign in to play"}
            </button>
          )}

          {ended && game && (
            <button
              onClick={() => game.rollId && openRoll(game.rollId)}
              disabled={!game.rollId}
              className={`text-xs font-semibold text-center py-1 rounded ${game.status === "cashed" ? "text-green-400" : "text-red-400"} disabled:opacity-50`}
            >
              {game.status === "cashed" ? <>Won <Monetary value={game.payout} showFraction /> at {game.multiplier.toFixed(2)}×</> : "Boom! Verify roll"}
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col p-5 gap-4">
          <div className="flex items-center justify-end gap-2 h-7 overflow-hidden">
            {history.map((h) => (
              <button
                key={h.key}
                onClick={() => h.rollId && openRoll(h.rollId)}
                className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${h.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
              >
                {h.won ? `${h.multiplier.toFixed(2)}×` : "✕"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-[560px] mx-auto w-full">
            {Array.from({ length: TILES }).map((_, tile) => {
              const face = tileFace(tile);
              const clickable = active && !busy && face.kind === "covered" && mode === "manual";
              return (
                <button
                  key={tile}
                  onClick={() => clickable && reveal(tile)}
                  disabled={!clickable}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all duration-150
                    ${face.kind === "covered"
                      ? `bg-gradient-to-b from-[#3a3560] to-[#2c2846] shadow-[0_4px_0_#1a1830] ${clickable ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_6px_0_#1a1830] hover:brightness-110 active:translate-y-0 active:shadow-[0_2px_0_#1a1830]" : "cursor-default"}`
                      : face.kind === "gem"
                        ? "bg-green-500/15 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] border border-green-500/40"
                        : face.kind === "mine"
                          ? `${face.hit ? "bg-red-500/30 border border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.6)]" : "bg-surface-nav shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] border border-line"}`
                          : "bg-surface-nav border border-line opacity-50"}`}
                >
                  {face.kind === "gem" && <Diamond />}
                  {face.kind === "mine" && <Bomb hit={face.hit} />}
                  {face.kind === "faint" && <div className="w-2 h-2 rounded-full bg-line" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-ink-muted text-xs max-w-[640px] text-center">
        Balance: <Monetary value={walletBalance} />. Collect diamonds, avoid the bombs.
      </p>
    </div>
  );
};

export default MinesView;
