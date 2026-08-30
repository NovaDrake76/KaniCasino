import Player from "../../Player";
import Monetary from "../../Monetary";
import { LiveBet } from "../../../services/liveFeed/LiveFeedService";
import { LiveBetsViewProps } from "./LiveBets.types";
import i18n from "../../../i18n";

// the feed's game keys against the names the leaderboard already translates, so one
// wording covers both surfaces
const GAME_KEY: Record<string, string> = {
    case: "caseOpening",
    coinflip: "coinFlip",
    crash: "crash",
    slots: "slots",
    plinko: "plinko",
    mines: "mines",
    hilo: "hilo",
    dice: "dice",
    blackjack: "blackjack",
};

const TH = "px-4 py-2.5 text-left text-[11px] font-medium text-ink-muted uppercase tracking-wider";
const TD = "px-4 py-2.5 whitespace-nowrap text-sm";

const gameName = (key: string) =>
    GAME_KEY[key] ? i18n.t(`leaderboard.games.${GAME_KEY[key]}`) : key;

const Row = ({ row }: { row: LiveBet }) => {
    const won = row.payout > row.bet;
    return (
        <tr>
            <td className={`${TD} font-semibold`}>{gameName(row.game)}</td>
            {/* Player centres itself, which floats the avatar into the middle of a wide
                column and away from the header above it */}
            <td className="px-4 py-2 [&_a>div]:justify-start">
                <Player user={row as never} size="small" />
            </td>
            <td className={`${TD} tabular-nums text-ink-soft`}>
                <Monetary value={row.bet} />
            </td>
            <td className={`${TD} tabular-nums text-ink-soft`}>{row.multiplier.toFixed(2)}x</td>
            <td className={`${TD} tabular-nums font-semibold ${won ? "text-emerald-400" : "text-ink-muted"}`}>
                {won ? <Monetary value={row.payout} /> : <>-<Monetary value={row.bet} /></>}
            </td>
        </tr>
    );
};

const LiveBetsView = ({ rows }: LiveBetsViewProps) => (
    <div className="w-full max-w-[1200px] mt-6">
        <div className="flex items-center gap-2 px-1 pb-2">
            <span className="w-[7px] h-[7px] bg-emerald-400" />
            <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-muted">
                {i18n.t("liveBets.title")}
            </h2>
        </div>
        <div className="w-full overflow-x-auto bg-surface rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-nav">
                    <tr>
                        <th className={TH}>{i18n.t("liveBets.game")}</th>
                        <th className={TH}>{i18n.t("liveBets.player")}</th>
                        <th className={TH}>{i18n.t("liveBets.bet")}</th>
                        <th className={TH}>{i18n.t("liveBets.multiplier")}</th>
                        <th className={TH}>{i18n.t("liveBets.payout")}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {rows.length ? (
                        rows.map((row) => <Row key={row.id} row={row} />)
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">
                                {i18n.t("liveBets.empty")}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

export default LiveBetsView;
