import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EMPTY, applyRound, clear, load, loadPosition, save, savePosition } from "./sessionStats";
import type { Point, Round, SessionStats } from "./sessionStats";

interface Value {
    stats: SessionStats;
    track: (round: Round) => void;
    reset: () => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    position: Point | null;
    setPosition: (point: Point) => void;
}

const SessionStatsContext = createContext<Value>({
    stats: EMPTY,
    track: () => undefined,
    reset: () => undefined,
    open: false,
    setOpen: () => undefined,
    position: null,
    setPosition: () => undefined,
});

const OPEN_KEY = "kani.liveStatsOpen";

export const SessionStatsProvider = ({ children }: { children: ReactNode }) => {
    const [stats, setStats] = useState<SessionStats>(() => load());
    const [open, setOpenState] = useState<boolean>(() => {
        try {
            return sessionStorage.getItem(OPEN_KEY) === "1";
        } catch {
            return false;
        }
    });

    const track = useCallback((round: Round) => {
        setStats((prev) => {
            const next = applyRound(prev, round);
            save(next);
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        clear();
        setStats(EMPTY);
    }, []);

    const [position, setPositionState] = useState<Point | null>(() => loadPosition());

    const setPosition = useCallback((point: Point) => {
        setPositionState(point);
        savePosition(point);
    }, []);

    const setOpen = useCallback((next: boolean) => {
        setOpenState(next);
        try {
            sessionStorage.setItem(OPEN_KEY, next ? "1" : "0");
        } catch {
            // the panel just will not remember, which is survivable
        }
    }, []);

    const value = useMemo(
        () => ({ stats, track, reset, open, setOpen, position, setPosition }),
        [stats, track, reset, open, setOpen, position, setPosition]
    );

    return <SessionStatsContext.Provider value={value}>{children}</SessionStatsContext.Provider>;
};

export const useSessionStats = () => useContext(SessionStatsContext);
