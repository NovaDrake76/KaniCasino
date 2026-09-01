import { useEffect, useRef, useState } from "react";
import { FiChevronRight, FiMessageSquare } from "react-icons/fi";
import ChatPanel from "./ChatPanel";
import i18n from "../../i18n";

const KEY = "kani.chatOpen";
// the games were fitted to 1366x768 in their own right, so the rail cannot simply take
// 300px off them: docked at 1366 the crash board overflowed by 37px. a window has to hold
// the rail and a full board before the rail is allowed to sit in the flow. below this the
// same panel opens as an overlay, and it starts closed.
const DOCK_WIDTH = 1500;
export const RAIL_WIDTH = 300;

// the build prerenders these routes, so nothing here may touch window during render
const isWide = () => typeof window !== "undefined" && window.innerWidth >= DOCK_WIDTH;

const readStored = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// how wide the page's own content actually is, so the rail can be told whether it needs
// to push anything. full-bleed pages measure the whole viewport; a centred board measures
// its card, and the margin either side is space the rail can simply sit in.
const CONTENT_ID = "page-content";

// only boxes that actually paint count. the page is wrapped in several transparent
// full-width divs, and measuring those said every page was full bleed, which is how the
// crash board ended up being pushed across when its own margin was already 360px wide.
const paints = (el: Element) => {
  if (el.tagName === "IMG" || el.tagName === "CANVAS" || el.tagName === "SVG") return true;
  const cs = getComputedStyle(el);
  if (cs.backgroundImage !== "none") return true;
  const bg = cs.backgroundColor;
  return !!bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)";
};

const contentWidth = () => {
  const host = document.getElementById(CONTENT_ID);
  if (!host) return 0;
  let left = Infinity;
  let right = -Infinity;

  // descending stops at the first box that paints: its children are inside it anyway, and
  // this keeps the walk to a few dozen nodes rather than the whole page
  const walk = (el: Element, depth: number) => {
    if (depth > 6) return;
    for (const child of Array.from(el.children)) {
      const r = child.getBoundingClientRect();
      if (r.width < 60 || r.height < 24) continue;
      if (paints(child)) {
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        continue;
      }
      walk(child, depth + 1);
    }
  };
  walk(host, 0);

  return right > left ? right - left : 0;
};

// whether the rail should be docked at all: wide enough for it, and asked for. it is a
// function of the two rather than a flag that gets flipped, because a flag can only be
// wrong in one direction and stay that way.
export const shouldDock = (wide: boolean, stored: string | null) => wide && stored === "1";

// closing on a resize is only right when a docked rail would otherwise become a modal, so
// it is keyed on the crossing rather than on the new width. a phone is under the width the
// whole time: asking "is it narrow now" closed the panel on every resize the device makes,
// and opening the keyboard to type is one of them.
export const closesOnResize = (wasWide: boolean, isWideNow: boolean) => wasWide && !isWideNow;

// the rail only pushes the page when the page has no room to give. a board centred in a
// wide window already leaves more than the rail needs on its left, and moving it across
// was pure churn. once it does have to push, it pushes the whole width rather than the
// shortfall: a half measure would leave the content overlapping the rail.
export const shiftFor = (viewport: number, content: number) =>
  content > 0 && (viewport - content) / 2 >= RAIL_WIDTH ? 0 : RAIL_WIDTH;

const useContentShift = (active: boolean) => {
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!active) {
      setShift(0);
      return;
    }
    let frame = 0;
    let hunt = 0;
    let stopped = false;

    // returns whether it found a page to measure at all. until it does, the rail keeps the
    // full push, because covering the content is the worse of the two failures.
    const measure = () => {
      frame = 0;
      const width = contentWidth();
      setShift(width > 0 ? shiftFor(window.innerWidth, width) : RAIL_WIDTH);
      return width > 0;
    };

    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    // the routes are lazy, so the first pass usually runs before the page exists. it used
    // to settle on the fallback there and never look again, which pushed every board across
    // whether or not it had the room.
    let tries = 0;
    const hunterTick = () => {
      if (stopped) return;
      if (!measure() && tries++ < 90) hunt = window.requestAnimationFrame(hunterTick);
    };
    hunterTick();

    // and once it is up, any reflow can move it: a route change, a panel opening, an image
    const observer = new ResizeObserver(queue);
    observer.observe(document.body);
    window.addEventListener("resize", queue);

    return () => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (hunt) window.cancelAnimationFrame(hunt);
      observer.disconnect();
      window.removeEventListener("resize", queue);
    };
  }, [active]);

  return shift;
};

export const useChatDock = () => {
  const [wide, setWide] = useState(isWide);
  const [open, setOpen] = useState(false);
  const shift = useContentShift(open && wide);

  // read back after mount rather than during render, so the prerendered html and the first
  // client render agree and react does not throw the whole tree away
  useEffect(() => {
    setOpen(shouldDock(isWide(), readStored()));
  }, []);

  // what the last resize saw, so a narrowing can be told from a screen that was always narrow
  const wasWide = useRef(isWide());

  useEffect(() => {
    const onResize = () => {
      const next = isWide();
      setWide(next);
      // only a window that has just stopped being wide closes: a docked rail must not turn
      // into a modal covering the page. an overlay opened on a phone stays, because the
      // soft keyboard and the collapsing url bar both arrive here as a resize.
      if (closesOnResize(wasWide.current, next)) setOpen(false);
      wasWide.current = next;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // one place that writes the preference, so no route into the state can forget to. the
  // close arrows used to call a setter that skipped this, and a chat closed on purpose
  // came straight back on the next reload.
  const remember = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // storage blocked: it still works, it just does not survive a reload
    }
    setOpen(next);
  };

  const toggle = () => remember(!open);

  return {
    open,
    wide,
    // what the page content has to give up, which is nothing when its own margin is
    // already wide enough to hold the rail
    shift,
    // what anything full width or left aligned has to give up, which is always the rail:
    // a footer that spans the window and a back button pinned to the left edge both sit
    // under it otherwise, however much room the centred content happens to have
    railWidth: open && wide ? RAIL_WIDTH : 0,
    toggle,
    close: () => remember(false),
    CONTENT_ID,
  };
};

interface DockProps {
  open: boolean;
  wide: boolean;
  onClose: () => void;
}


// the rail is fixed, not in the flow. in the flow it was pushed down by whatever the
// header happened to render above it, the back button included, and a 100svh panel starting
// below the navbar hung off the bottom of the page: the input was unreachable until you
// scrolled. fixed and measured against the navbar instead, so it always fills exactly the
// space under it and contributes no page height at all.
const useTopOffset = (active: boolean) => {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const nav = document.querySelector("nav");
      const bottom = nav ? nav.getBoundingClientRect().bottom : 0;
      setTop(Math.max(0, Math.round(bottom)));
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // the header is lazy loaded and the back button comes and goes with the route, so the
    // offset is re-read whenever the page reflows rather than measured once
    const observer = new ResizeObserver(queue);
    observer.observe(document.body);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [active]);

  return top;
};

// wide screens dock it beside the page and the content shifts. narrow ones get the same
// panel as an overlay, so a phone never has a rail competing with the board.
const ChatDock = ({ open, wide, onClose }: DockProps) => {
  const top = useTopOffset(open && wide);
  if (!open) return null;

  if (wide) {
    return (
      <div
        className="fixed left-0 z-sticky border-r border-line"
        style={{ top, bottom: 0, width: RAIL_WIDTH }}
      >
        <ChatPanel open onClose={onClose} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-overlay flex">
      <div className="h-full w-[min(320px,85vw)] border-r border-line">
        <ChatPanel open onClose={onClose} />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={i18n.t("chat.hide")}
        className="h-full flex-1 bg-black/60"
      />
    </div>
  );
};

// the way back in. it sits where the close arrow was, at the bottom of the left edge, so
// the control that hides the rail and the one that brings it back are the same button in
// the same place. it used to live up in the navbar, a screen away from the panel itself.
export const ChatToggle = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={i18n.t("chat.show")}
    className="fixed bottom-0 left-0 z-sticky flex items-center gap-1.5 border-r border-t border-line bg-surface px-3 py-2 text-ink-soft hover:bg-surface-hover hover:text-white"
  >
    <FiMessageSquare className="text-base" />
    <FiChevronRight className="text-sm" />
  </button>
);

export default ChatDock;
