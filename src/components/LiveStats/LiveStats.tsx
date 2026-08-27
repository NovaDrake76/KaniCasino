import { AiOutlineClose } from "react-icons/ai";
import { MdOutlineShowChart, MdRefresh } from "react-icons/md";
import Monetary from "../Monetary";
import Sparkline from "./Sparkline";
import { useDraggable } from "./useDraggable";
import { useSessionStats } from "../../stats/SessionStatsContext";
import { profitOf } from "../../stats/sessionStats";
import i18n from "../../i18n";

const Figure = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="text-base font-bold truncate">{value}</span>
    </div>
);

// the panel is opened from the game bar and dragged by its header. closing only hides it:
// the tally is reset by the button that says so, or by closing the tab.
const LiveStats = () => {
    const { stats, reset, open, setOpen, position, setPosition } = useSessionStats();
    const { ref, point, handlers } = useDraggable(position, setPosition);
    const profit = profitOf(stats);

    if (!open) return null;

    const profitTone = profit > 0 ? "text-green-400" : profit < 0 ? "text-red-400" : "text-ink";

    return (
        <div
            ref={ref}
            style={point ? { left: point.x, top: point.y } : { right: 16, bottom: 16 }}
            className="fixed z-overlay w-[19rem] max-w-[calc(100vw-2rem)] select-none rounded-xl border border-line bg-surface-nav shadow-2xl"
        >
            <div
                {...handlers}
                className="flex cursor-move touch-none items-center gap-2 px-4 py-3"
            >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-raised text-secondary-light">
                    <MdOutlineShowChart className="text-base" />
                </span>
                <span className="flex-1 text-sm font-bold">{i18n.t("liveStats.title")}</span>
                <button
                    onClick={reset}
                    aria-label={i18n.t("liveStats.reset")}
                    title={i18n.t("liveStats.reset")}
                    className="rounded-lg border-0 bg-transparent p-1.5 text-lg text-ink-faint transition-colors hover:bg-surface hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-light"
                >
                    <MdRefresh />
                </button>
                <button
                    onClick={() => setOpen(false)}
                    aria-label={i18n.t("liveStats.hide")}
                    title={i18n.t("liveStats.hide")}
                    className="rounded-lg border-0 bg-transparent p-1.5 text-base text-ink-faint transition-colors hover:bg-surface hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-light"
                >
                    <AiOutlineClose />
                </button>
            </div>

            <div className="flex flex-col gap-3 px-3 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface p-4">
                    <Figure label={i18n.t("liveStats.profit")} value={<span className={profitTone}><Monetary value={profit} /></span>} />
                    <Figure label={i18n.t("liveStats.wins")} value={<span className="text-green-400">{stats.wins}</span>} />
                    <Figure label={i18n.t("liveStats.wagered")} value={<Monetary value={stats.wagered} />} />
                    <Figure label={i18n.t("liveStats.losses")} value={<span className="text-red-400">{stats.losses}</span>} />
                </div>

                <div className="flex h-32 items-center justify-center rounded-lg bg-surface p-3">
                    {stats.rounds === 0 ? (
                        <div className="flex w-full flex-col items-center gap-3">
                            <span className="h-px w-2/3 bg-line-strong" />
                            <span className="px-2 text-center text-xs text-ink-muted">{i18n.t("liveStats.empty")}</span>
                        </div>
                    ) : (
                        <Sparkline points={stats.points} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveStats;
