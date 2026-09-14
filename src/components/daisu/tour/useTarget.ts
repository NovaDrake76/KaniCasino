import { useEffect, useState } from "react";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Target {
  rect: Rect | null;
  // what the page says about the element through data-tour-state, like a case too dear to open
  state: string | null;
}

const NONE: Target = { rect: null, state: null };

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

// where a [data-tour] element sits on screen, following scroll and layout. it is scrolled into
// view once when found; a page that renders late is simply waited for
export const useTarget = (target: string | null): Target => {
  const [found, setFound] = useState<Target>(NONE);

  useEffect(() => {
    setFound(NONE);
    if (!target) return;
    let frame = 0;
    let scrolled = false;
    let last = NONE;

    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      const box = el ? el.getBoundingClientRect() : null;
      const rect =
        box && box.width > 0 && box.height > 0
          ? { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) }
          : null;
      const state = el ? el.getAttribute("data-tour-state") : null;
      if (el && rect && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (!sameRect(last.rect, rect) || last.state !== state) {
        last = { rect, state };
        setFound(last);
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return found;
};
