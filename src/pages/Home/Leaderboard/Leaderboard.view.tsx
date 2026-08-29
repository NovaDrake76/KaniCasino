import Skeleton from "react-loading-skeleton";
import Title from "../../../components/Title";
import Player from "../../../components/Player";
import Monetary from "../../../components/Monetary";
import { BoardStanding } from "../../../services/leaderboard/LeaderboardService";
import { Countdown, LeaderboardViewProps } from "./Leaderboard.types";
import i18n from "../../../i18n";

const num = (value: number) => new Intl.NumberFormat("en-US").format(value);

const Segment = ({ value, label, lit }: { value: string; label: string; lit?: boolean }) => (
    <div className="flex flex-col items-center gap-1.5">
        <div className={`bg-surface tabular-nums px-3 py-2 min-w-[62px] text-center text-3xl md:text-4xl font-bold leading-none ${lit ? "text-accent-amber" : ""}`}>
            {value}
        </div>
        <span className="text-[10px] font-bold tracking-[0.12em] text-ink-muted">{label}</span>
    </div>
);

const Clock = ({ countdown }: { countdown: Countdown }) => (
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
    </div>
);

const PodiumPlace = ({ user }: { user: BoardStanding }) => {
    const first = user.rank === 1;
    return (
        <div className={`relative w-48 md:w-56 xl:w-64 ${first ? "-mt-10" : "hidden md:block"}`}>
            <div className="relative z-raised flex flex-col items-center">
                <Player user={user as never} size={first ? "extra-large" : "large"} direction="column" showLevel />
                <span className={`mt-2 font-bold ${first ? "text-4xl text-accent-gold" : "text-2xl text-ink-soft"}`}>
                    #{user.rank}
                </span>
                <span className={`mt-6 tabular-nums font-bold ${first ? "text-2xl" : "text-xl"}`}>
                    {num(user.points)}
                </span>
                <span className="text-[10px] font-bold tracking-[0.12em] text-ink-muted">
                    {i18n.t("leaderboard.points")}
                </span>
                <span className={`mt-4 font-extrabold text-accent-gold ${first ? "text-3xl" : "text-2xl"}`}>
                    <Monetary value={user.prize} />
                </span>
            </div>
            <img src="images/podium.svg" alt="" className="absolute top-[70px] z-0" />
        </div>
    );
};

const Row = ({ user }: { user: BoardStanding }) => (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[64px_minmax(0,1fr)_130px_120px] items-center gap-3 bg-surface px-4 py-3">
        <span className="tabular-nums font-bold text-ink-soft">{user.rank}</span>
        <div className="min-w-0 flex items-center gap-3">
            <Player user={user as never} size="small" />
        </div>
        <span className="hidden md:block text-right tabular-nums font-bold">{num(user.points)}</span>
        <div className="flex justify-end">
            <span className="bg-surface-raised border border-line rounded px-3 py-1.5 text-sm font-bold text-accent-gold">
                <Monetary value={user.prize} />
            </span>
        </div>
    </div>
);

const YourRow = ({ me, paidPlaces }: { me: NonNullable<LeaderboardViewProps["me"]>; paidPlaces: number }) => (
    <div className="mt-5 flex items-stretch">
        <div className="w-[3px] bg-accent" />
        <div className="flex-grow grid grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[64px_minmax(0,1fr)_130px_120px] items-center gap-3 bg-surface-nav px-4 py-4">
            <span className="tabular-nums font-bold text-ink-soft">{me.rank ?? "-"}</span>
            <div className="min-w-0 flex flex-col gap-0.5">
                <span className="font-bold">{i18n.t("leaderboard.you")}</span>
                {me.toPaidPlace > 0 && (
                    <span className="tabular-nums text-xs text-ink-muted">
                        {i18n.t("leaderboard.fromPlace", { points: num(me.toPaidPlace), place: paidPlaces })}
                    </span>
                )}
            </div>
            <span className="hidden md:block text-right tabular-nums font-bold">{num(me.points)}</span>
            <div className="flex justify-end">
                {me.prize > 0 ? (
                    <span className="bg-surface-raised border border-line rounded px-3 py-1.5 text-sm font-bold text-accent-gold">
                        <Monetary value={me.prize} />
                    </span>
                ) : (
                    <span className="text-xs text-ink-muted">{i18n.t("leaderboard.notPaidYet")}</span>
                )}
            </div>
        </div>
    </div>
);

const ResultBanner = ({
    result,
    onDismiss,
}: {
    result: NonNullable<LeaderboardViewProps["lastResult"]>;
    onDismiss: () => void;
}) => (
    <div className="mb-8 flex items-stretch">
        <div className="w-1 bg-accent-gold" />
        <div className="flex-grow bg-surface px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold tracking-[0.12em] text-accent-gold">
                    {i18n.t("leaderboard.resultTitle", { rank: result.rank })}
                </span>
                <span className="tabular-nums text-xl font-bold">
                    {i18n.t("leaderboard.resultPoints", { points: num(result.points) })}
                </span>
                <span className="text-sm text-ink-soft">{i18n.t("leaderboard.resultPaid")}</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-3xl font-extrabold text-accent-gold">
                    <Monetary value={result.prize} />
                </span>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={i18n.t("leaderboard.close")}
                    className="w-8 h-8 bg-surface-raised hover:bg-surface-hover text-ink-muted flex items-center justify-center"
                >
                    x
                </button>
            </div>
        </div>
    </div>
);

const PointsPanel = ({ points, onClose }: { points: LeaderboardViewProps["points"]; onClose: () => void }) => (
    <div className="mt-6 bg-surface-nav p-6">
        <div className="flex items-start justify-between gap-5">
            <div>
                <h3 className="text-lg font-bold">{i18n.t("leaderboard.pointsTitle")}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                    {i18n.t("leaderboard.pointsBlurb")}
                </p>
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
    countdown,
    pool,
    paidPlaces,
    me,
    lastResult,
    dismissResult,
    points,
    showPoints,
    openPoints,
    closePoints,
    aside,
}: LeaderboardViewProps) => (
    <div className="flex flex-col items-center justify-center w-full max-w-[360px] md:max-w-none">
        <div className="w-full max-w-[1160px] px-4">
            {lastResult && <ResultBanner result={lastResult} onDismiss={dismissResult} />}

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                <div className="w-fit">
                    <Title title={i18n.t("leaderboard.title")} compact />
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
                        {i18n.t("leaderboard.blurb", { places: paidPlaces })}
                    </p>
                    <button
                        type="button"
                        onClick={openPoints}
                        className="mt-3 text-[13px] font-semibold text-secondary-light hover:text-white"
                    >
                        {i18n.t("leaderboard.howPoints")}
                    </button>
                </div>
                <div className="flex flex-col items-center lg:items-end gap-3">
                    <Clock countdown={countdown} />
                    <div className="flex items-center gap-2.5 text-[13px] text-ink-soft">
                        <span>{i18n.t("leaderboard.paidToday")}</span>
                        <span className="text-[17px] font-bold text-accent-gold">
                            <Monetary value={pool} />
                        </span>
                        <span className="text-line-strong">|</span>
                        <span className="font-semibold">{i18n.t("leaderboard.topN", { count: paidPlaces })}</span>
                    </div>
                </div>
            </div>

            {showPoints && <PointsPanel points={points} onClose={closePoints} />}

            {loading ? (
                <div className="mt-10">
                    <Skeleton count={6} height={64} />
                </div>
            ) : podium.length ? (
                <>
                    <div className="flex justify-center items-end gap-4 md:gap-6 xl:gap-14 mt-12 mb-4">
                        {podium.map((user) => (
                            <PodiumPlace key={user._id} user={user} />
                        ))}
                    </div>

                    <div className="hidden md:grid grid-cols-[64px_minmax(0,1fr)_130px_120px] gap-3 px-4 pb-3 text-[10px] font-bold tracking-[0.14em] text-ink-muted">
                        <span>{i18n.t("leaderboard.rank")}</span>
                        <span>{i18n.t("leaderboard.player")}</span>
                        <span className="text-right">{i18n.t("leaderboard.points")}</span>
                        <span className="text-right">{i18n.t("leaderboard.prize")}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {rest.map((user) => (
                            <Row key={user._id} user={user} />
                        ))}
                    </div>
                    {me && <YourRow me={me} paidPlaces={paidPlaces} />}
                </>
            ) : (
                <div className="mt-12 flex flex-col items-center gap-3 bg-surface px-6 py-12 text-center">
                    <p className="text-sm text-ink-soft">{i18n.t("leaderboard.empty")}</p>
                </div>
            )}

            {aside && <div className="mt-10">{aside}</div>}
        </div>
    </div>
);

export default LeaderboardView;
