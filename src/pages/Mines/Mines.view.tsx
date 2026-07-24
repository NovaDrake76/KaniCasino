import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import { AUTO_COUNTS } from "./Mines.services";
import { MAX_BET, TILES, mineOptions } from "./minesGrid";
import { MinesViewProps } from "./Mines.types";

const StarGem = () => (
  <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 drop-shadow">
    <defs>
      <linearGradient id="mines-star" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe680" />
        <stop offset="1" stopColor="#f2b705" />
      </linearGradient>
    </defs>
    <path
      fill="url(#mines-star)"
      stroke="#7a5c00"
      strokeWidth="0.6"
      d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.3 20.3l1.7-6.6L2.8 9.3l6.8-.5z"
    />
  </svg>
);

const Seal = ({ hit }: { hit: boolean }) => (
  <svg viewBox="0 0 24 24" className={`w-2/3 h-2/3 ${hit ? "" : "opacity-70"}`}>
    <g fill={hit ? "#ef4444" : "#b0355f"}>
      <circle cx="12" cy="12" r="5" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <path
            key={i}
            d={`M12 12 L${12 + Math.cos(a) * 10} ${12 + Math.sin(a) * 10} L${12 + Math.cos(a + 0.28) * 6} ${12 + Math.sin(a + 0.28) * 6} Z`}
          />
        );
      })}
    </g>
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
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all
                    ${face.kind === "covered"
                      ? `bg-surface-raised ${clickable ? "hover:bg-surface-hover hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}`
                      : face.kind === "gem"
                        ? "bg-green-500/15 border border-green-500/40"
                        : face.kind === "mine"
                          ? `${face.hit ? "bg-red-500/30 border border-red-500" : "bg-surface-nav border border-line"}`
                          : "bg-surface-nav border border-line opacity-60"}`}
                >
                  {face.kind === "gem" && <StarGem />}
                  {face.kind === "mine" && <Seal hit={face.hit} />}
                  {face.kind === "faint" && <div className="w-2 h-2 rounded-full bg-line" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-ink-muted text-xs max-w-[640px] text-center">
        Balance: <Monetary value={walletBalance} />. Collect stars, avoid the spell-card seals. Every game is provably fair, 99% RTP.
      </p>
    </div>
  );
};

export default MinesView;
