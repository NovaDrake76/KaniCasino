import Monetary from "../../components/Monetary";
import RoundPlayer from "../../components/game/RoundPlayer";
import i18n from "../../i18n";

type Side = "heads" | "tails" | "purple";

interface SideState {
  players?: Record<string, { username: string; profilePicture?: string; level?: number }>;
  bets?: Record<string, number>;
}

type RoundState = Partial<Record<Side, SideState>>;

interface RoundBetsProps {
  gameState: RoundState | null;
  sides: Side[];
}

const DOT: Record<Side, string> = { heads: "bg-red-500", tails: "bg-green-500", purple: "bg-violet-600" };

const sideOf = (gameState: RoundState | null, side: Side) => {
  const players = gameState?.[side]?.players || {};
  const bets = gameState?.[side]?.bets || {};
  const ids = Object.keys(players);
  const total = ids.reduce((sum, id) => sum + (bets[id] || 0), 0);
  return { players, bets, ids, total };
};

// the right end of the tab row: everyone on this flip, across every side
export const RoundSummary = ({ gameState, sides }: RoundBetsProps) => {
  const all = sides.map((side) => sideOf(gameState, side));
  const players = all.reduce((sum, s) => sum + s.ids.length, 0);
  const total = all.reduce((sum, s) => sum + s.total, 0);
  return (
    <span className="py-2 text-[13px] text-ink-muted">
      {i18n.t("gameInfo.round.players", { count: players })} ·{" "}
      <strong className="font-bold text-accent-gold">
        <Monetary value={total} />
      </strong>
    </span>
  );
};

const SideBets = ({ gameState, side }: { gameState: RoundState | null; side: Side }) => {
  const { players, bets, ids, total } = sideOf(gameState, side);
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-nav px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className={`h-3 w-3 rounded-full ${DOT[side]}`} />
          {i18n.t(`coin.${side}`)}
        </span>
        <span className="text-sm font-semibold tabular-nums text-ink-soft">
          <Monetary value={total} />
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {ids.length ? (
          ids.map((id) => (
            <div key={id} className="flex items-center justify-between gap-3 px-4 py-2">
              <RoundPlayer id={id} player={players[id]} />
              <span className="shrink-0 text-sm tabular-nums text-ink-soft">
                <Monetary value={bets[id] || 0} />
              </span>
            </div>
          ))
        ) : (
          <span className="px-4 py-6 text-center text-sm text-ink-muted">{i18n.t("gameInfo.round.emptySide")}</span>
        )}
      </div>
    </div>
  );
};

// one column per side of the coin, each with who is on it and how much
const RoundBets = ({ gameState, sides }: RoundBetsProps) => (
  <div className="flex w-full flex-col gap-4 lg:flex-row">
    {sides.map((side) => (
      <SideBets key={side} gameState={gameState} side={side} />
    ))}
  </div>
);

export default RoundBets;
