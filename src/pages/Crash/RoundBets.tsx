import Monetary from "../../components/Monetary";
import RoundPlayer from "../../components/game/RoundPlayer";
import i18n from "../../i18n";

interface RoundState {
  gamePlayers?: Record<string, { username: string; profilePicture?: string; level?: number; payout?: number }>;
  gameBets?: Record<string, number>;
}

interface RoundBetsProps {
  gameState: RoundState | null;
}

const TH = "px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted";
const TD = "px-4 py-2.5 whitespace-nowrap text-sm tabular-nums";

const roundOf = (gameState: RoundState | null) => {
  const players = gameState?.gamePlayers || {};
  const bets = gameState?.gameBets || {};
  const ids = Object.keys(players);
  const total = ids.reduce((sum, id) => sum + (bets[id] || 0), 0);
  return { players, bets, ids, total };
};

// the right end of the tab row: how many are in this round and how much rides on it
export const RoundSummary = ({ gameState }: RoundBetsProps) => {
  const { ids, total } = roundOf(gameState);
  return (
    <span className="py-2 text-[13px] text-ink-muted">
      {i18n.t("gameInfo.round.players", { count: ids.length })} ·{" "}
      <strong className="font-bold text-accent-gold">
        <Monetary value={total} />
      </strong>
    </span>
  );
};

// who rides the current round, and who has already cashed out of it
const RoundBets = ({ gameState }: RoundBetsProps) => {
  const { players, bets, ids } = roundOf(gameState);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="min-w-full divide-y divide-line">
        <thead className="bg-surface-nav">
          <tr>
            <th className={TH}>{i18n.t("liveBets.player")}</th>
            <th className={TH}>{i18n.t("liveBets.bet")}</th>
            <th className={TH}>{i18n.t("gameInfo.round.cashedOut")}</th>
            <th className={TH}>{i18n.t("gameInfo.round.profit")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ids.length ? (
            ids.map((id) => {
              const player = players[id];
              const bet = bets[id] || 0;
              const out = player.payout;
              return (
                <tr key={id}>
                  <td className="px-4 py-2">
                    <RoundPlayer id={id} player={player} />
                  </td>
                  <td className={`${TD} text-ink-soft`}>
                    <Monetary value={bet} />
                  </td>
                  <td className={`${TD} text-ink-soft`}>{out ? `${out.toFixed(2)}x` : "-"}</td>
                  <td className={`${TD} font-semibold ${out ? "text-emerald-400" : "text-ink-muted"}`}>
                    {out ? (
                      <>
                        +<Monetary value={bet * out - bet} />
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-muted">
                {i18n.t("gameInfo.round.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RoundBets;
