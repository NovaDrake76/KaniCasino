import { useCallback, useEffect, useRef, useState } from "react";
import { MdOutlineShowChart } from "react-icons/md";
import { FiLock } from "react-icons/fi";
import { GameBarButton } from "../game/GameBar";
import LiveStats from "./LiveStats";
import LockedBanner from "../daisu/shop/LockedBanner";
import { useLocked } from "../daisu/shop/useLocked";
import { SHOP_OPEN_EVENT } from "../daisu/tour/tourEvents";
import useOutsideClick from "../../hooks/useOutsideClick";
import { useSessionStats } from "../../stats/SessionStatsContext";
import i18n from "../../i18n";

// the icon stays in sight while locked, so the spyglass in her shop has something to point at
const Locked = () => {
    const [shown, setShown] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const close = useCallback(() => setShown(false), []);
    useOutsideClick(ref, close);

    useEffect(() => {
        window.addEventListener(SHOP_OPEN_EVENT, close);
        return () => window.removeEventListener(SHOP_OPEN_EVENT, close);
    }, [close]);

    return (
        <span ref={ref} data-tour="live-stats" className="relative flex">
            <GameBarButton onClick={() => setShown(!shown)} label={i18n.t("daisu.shop.items.spyglass.lockedTitle")} active={shown}>
                <span className="relative block">
                    <MdOutlineShowChart />
                    <FiLock aria-hidden className="absolute -bottom-1 -right-1.5 text-[10px] text-accent-gold" />
                </span>
            </GameBarButton>
            {shown && (
                <div className="absolute bottom-full left-0 z-overlay mb-2 w-72 max-w-[calc(100vw-2rem)] shadow-2xl">
                    <LockedBanner unlock="spyglass" compact />
                </div>
            )}
        </span>
    );
};

const LiveStatsButton = () => {
    const { open, setOpen } = useSessionStats();
    const locked = useLocked("spyglass");
    if (locked) return <Locked />;
    return (
        <>
            <span data-tour="live-stats" className="flex">
                <GameBarButton onClick={() => setOpen(!open)} label={i18n.t("liveStats.title")} active={open}>
                    <MdOutlineShowChart />
                </GameBarButton>
            </span>
            <LiveStats />
        </>
    );
};

export default LiveStatsButton;
