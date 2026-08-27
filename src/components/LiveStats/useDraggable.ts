import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "../../stats/sessionStats";

const MARGIN = 16;

// keeps the panel on screen: a window that shrinks after the panel was dragged to the
// far edge would otherwise strand it somewhere the player cannot reach
const clamp = (point: Point, size: { w: number; h: number }): Point => ({
    x: Math.min(Math.max(MARGIN, point.x), Math.max(MARGIN, window.innerWidth - size.w - MARGIN)),
    y: Math.min(Math.max(MARGIN, point.y), Math.max(MARGIN, window.innerHeight - size.h - MARGIN)),
});

export const useDraggable = (stored: Point | null, commit: (point: Point) => void) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const grab = useRef<Point | null>(null);
    const [point, setPoint] = useState<Point | null>(stored);

    // the resting place before the player has moved it: the bottom right corner
    useEffect(() => {
        if (point || !ref.current) return;
        const { width, height } = ref.current.getBoundingClientRect();
        setPoint({ x: window.innerWidth - width - MARGIN, y: window.innerHeight - height - MARGIN });
    }, [point]);

    useEffect(() => {
        const onResize = () => {
            const el = ref.current;
            if (!el || !point) return;
            const { width, height } = el.getBoundingClientRect();
            setPoint((p) => (p ? clamp(p, { w: width, h: height }) : p));
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [point]);

    const onPointerDown = useCallback((event: React.PointerEvent) => {
        const el = ref.current;
        if (!el || event.button !== 0) return;
        // the close and reset buttons live in the drag handle, and preventDefault below
        // would swallow their click: a press on a control is never the start of a drag
        if ((event.target as HTMLElement).closest("button")) return;
        const rect = el.getBoundingClientRect();
        grab.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        event.preventDefault();
    }, []);

    const onPointerMove = useCallback((event: React.PointerEvent) => {
        const el = ref.current;
        const offset = grab.current;
        if (!el || !offset) return;
        const { width, height } = el.getBoundingClientRect();
        setPoint(clamp({ x: event.clientX - offset.x, y: event.clientY - offset.y }, { w: width, h: height }));
    }, []);

    const onPointerUp = useCallback(
        (event: React.PointerEvent) => {
            if (!grab.current) return;
            grab.current = null;
            (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
            if (point) commit(point);
        },
        [point, commit]
    );

    return { ref, point, dragging: grab.current !== null, handlers: { onPointerDown, onPointerMove, onPointerUp } };
};
