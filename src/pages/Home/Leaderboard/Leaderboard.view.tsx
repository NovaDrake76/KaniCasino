import Skeleton from "react-loading-skeleton";
import Title from "../../../components/Title";
import Player from "../../../components/Player";
import Monetary from "../../../components/Monetary";
import TopPlayer from "../../../components/TopPlayer";
import { BoardStanding } from "../../../services/leaderboard/LeaderboardService";
import { Countdown, LeaderboardViewProps } from "./Leaderboard.types";
import i18n from "../../../i18n";

const num = (value: number) => new Intl.NumberFormat("en-US").format(value);

const TH = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

const Segment = ({ value, label, lit }: { value: string; label: string; lit?: boolean }) => (
    <div className="flex flex-col items-center gap-1.5">
        <div className={`bg-surface tabular-nums px-3 py-2 min-w-[62px] text-center text-3xl font-bold leading-none ${lit ? "text-accent-amber" : ""}`}>
            {value}
        </div>
        <span className="text-[10px] font-bold tracking-[0.12em] text-ink-muted">{label}</span>
    </div>
);

const Clock = ({ countdown, pool, paidPlaces }: { countdown: Countdown; pool: number; paidPlaces: number }) => (
    <div className="flex flex-col items-center lg:items-end gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ink-muted">
            <span className="w-[7px] h-[7px] bg-accent-amber" />
            {i18n.t("leaderboard.resetsIn")}
        </div>
        <div className="flex items-start gap-2">
            <Segment value={countdown.hours} label={i18n.t("leaderboard.hours")} />
            <span className="text-2xl font-bold text-line-strong pt-1.5">:</span>
            <Segment value={countdown.minutes} label={i18n.t("leaderboard.minutes")} />
            <span className="text-2xl font-bold text-line-strong pt-1.5">:</span>
            <Segment value={countdown.seconds} label={i18n.t("leaderboard.seconds")} lit />
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-ink-soft">
            <span>{i18n.t("leaderboard.paidToday")}</span>
            <span className="text-[17px] font-bold text-accent-gold">
                <Monetary value={pool} />
            </span>
            <span className="text-line-strong">|</span>
            <span className="font-semibold">{i18n.t("leaderboard.topN", { count: paidPlaces })}</span>
        </div>
    </div>
);

const Row = ({ user, mine, mobileOnly }: { user: BoardStanding; mine?: boolean; mobileOnly?: boolean }) => (
    <tr className={`${mine ? "bg-surface-nav" : ""} ${mobileOnly ? "md:hidden" : ""} ${user.placeholder ? "opacity-60" : ""}`}>
        <td className="px-6 py-4 whitespace-nowrap">#{user.rank}</td>
        <td className="flex p-4 items-center gap-2">
            <Player user={user as never} size="small" />
        </td>
        <td className="px-6 py-4 whitespace-nowrap tabular-nums">{num(user.points)}</td>
        <td className="px-6 py-4 whitespace-nowrap">
            {user.placeholder ? (
                <span className="text-ink-muted">-</span>
            ) : (
                <span className="font-bold text-accent-gold">
                    <Monetary value={user.prize} />
                </span>
            )}
        </td>
    </tr>
);

const YourRow = ({ me, paidPlaces }: { me: NonNullable<LeaderboardViewProps["me"]>; paidPlaces: number }) => (
    <tr className="bg-surface-nav">
        <td className="px-6 py-4 whitespace-nowrap">{me.rank ? `#${me.rank}` : "-"}</td>
        <td className="p-4">
            <span className="font-bold">{i18n.t("leaderboard.you")}</span>
            {/* gated on rank: a player who has not bet today is not "1 point from 10th",
                they are simply not on the board yet */}
            {me.rank !== null && me.toPaidPlace > 0 && (
                <span className="block tabular-nums text-xs text-ink-muted">
                    {i18n.t("leaderboard.fromPlace", { points: num(me.toPaidPlace), place: paidPlaces })}
                </span>
            )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap tabular-nums">{num(me.points)}</td>
        <td className="px-6 py-4 whitespace-nowrap">
            {me.prize > 0 ? (
                <span className="font-bold text-accent-gold">
                    <Monetary value={me.prize} />
                </span>
            ) : (
                <span className="text-xs text-ink-muted">{i18n.t("leaderboard.notPaidYet")}</span>
            )}
        </td>
    </tr>
);

const PointsPanel = ({ points, onClose }: { points: LeaderboardViewProps["points"]; onClose: () => void }) => (
    <div className="bg-surface-nav p-6">
        <div className="flex items-start justify-between gap-5">
            <div>
                <h3 className="text-lg font-bold">{i18n.t("leaderboard.pointsTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{i18n.t("leaderboard.pointsBlurb")}</p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={i18n.t("leaderboard.close")}
                className="w-8 h-8 bg-surface hover:bg-surface-hover text-ink-muted flex items-center justify-center flex-shrink-0"
            >
                x
            </button>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_90px_80px] px-3 pb-2 text-[10px] font-bold tracking-[0.14em] text-ink-muted">
            <span>{i18n.t("leaderboard.game")}</span>
            <span className="text-right">{i18n.t("leaderboard.houseEdge")}</span>
            <span className="text-right">{i18n.t("leaderboard.points")}</span>
        </div>
        <div className="flex flex-col gap-[3px]">
            {points.map((game) => (
                <div key={game.type} className="grid grid-cols-[minmax(0,1fr)_90px_80px] items-center bg-surface px-3 py-2.5">
                    <span className="text-sm font-semibold">{i18n.t(`leaderboard.games.${game.key}`)}</span>
                    <span className="text-right text-[13px] tabular-nums text-ink-muted">
                        {game.edge === null ? i18n.t("leaderboard.edgeVaries") : `${game.edge}%`}
                    </span>
                    <span className={`text-right text-[15px] font-bold tabular-nums ${game.multiplier >= 1 ? "text-accent-gold" : "text-ink-soft"}`}>
                        {game.multiplier.toFixed(2)}x
                    </span>
                </div>
            ))}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-ink-muted">{i18n.t("leaderboard.notScored")}</p>
    </div>
);

const LeaderboardView = ({
    loading,
    podium,
    rest,
    podiumRest,
    countdown,
    pool,
    paidPlaces,
    me,
    meOnBoard,
    points,
    showPoints,
    openPoints,
    closePoints,
    aside,
}: LeaderboardViewProps) => (
    <div className="flex flex-col items-center justify-center max-w-[360px] md:max-w-none">

        <div className="w-full max-w-[1620px] px-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="w-fit">
                <Title title={i18n.t("leaderboard.title")} />
                <p className="max-w-md text-sm leading-relaxed text-ink-soft">
                    {i18n.t("leaderboard.blurb", { places: paidPlaces })}
                </p>
                {/* a button so it stays keyboard reachable, stripped of the padding a
                    button carries by default: that was indenting it past the copy above */}
                <button
                    type="button"
                    onClick={openPoints}
                    className="mt-3 p-0 text-left text-[13px] font-semibold text-secondary-light hover:text-white"
                >
                    {i18n.t("leaderboard.howPoints")}
                </button>
            </div>
            <Clock countdown={countdown} pool={pool} paidPlaces={paidPlaces} />
        </div>

        <div className="grid w-full max-w-[1620px] gap-8 px-4 lg:grid-cols-[340px_minmax(0,1fr)_340px]">
            <div className="flex flex-col items-center lg:col-start-2 lg:row-start-1">
                {showPoints && (
                    <div className="w-full mt-8">
                        <PointsPanel points={points} onClose={closePoints} />
                    </div>
                )}

                {/* the podium used to hold 330px open whenever it had fewer than three
                    players, so a board that had just reset was a screen of nothing. it
                    also drew nobody at one or two players, who then appeared on no
                    surface at all. */}
                {loading && <div className="h-[330px]" />}
                {!loading && podium.length > 0 && (
                    <div className="flex gap-4 md:gap-6 xl:gap-14 my-16">
                        {podium.map((user) => (
                            <TopPlayer key={user._id} user={user} rank={user.rank} />
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full min-w-0 overflow-x-auto lg:col-start-2 lg:row-start-2">
                <table className="min-w-full divide-y divide-gray-500">
                    {/* column headings over an empty table say nothing: the message below
                        is the whole content when the board has just reset */}
                    <thead className={`bg-[#19172d] ${!loading && !podium.length && !me ? "hidden" : ""}`}>
                        <tr>
                            <th className={TH}>{i18n.t("leaderboard.rank")}</th>
                            <th className={TH}>{i18n.t("leaderboard.player")}</th>
                            <th className={TH}>{i18n.t("leaderboard.points")}</th>
                            <th className={TH}>{i18n.t("leaderboard.prize")}</th>
                        </tr>
                    </thead>
                    <tbody className=" divide-y divide-[#19172d]">
                        {loading && (
                            <tr>
                                <td colSpan={4}>
                                    <Skeleton count={10} height={72} />
                                </td>
                            </tr>
                        )}

                        {!loading && podiumRest.map((user) => (
                            <Row key={user._id} user={user} mine={me?._id === user._id} mobileOnly />
                        ))}
                        {!loading && rest.map((user) => (
                            <Row key={user._id} user={user} mine={me?._id === user._id} />
                        ))}
                        {/* only when they are not already a row above, or the board shows
                            the same player twice */}
                        {!loading && me && !meOnBoard && <YourRow me={me} paidPlaces={paidPlaces} />}
                        {!loading && !podium.length && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-sm text-ink-soft">
                                    {i18n.t("leaderboard.empty")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {aside && <div className="w-full lg:col-start-3 lg:row-start-2">{aside}</div>}
        </div>
    </div>
);

export default LeaderboardView;
