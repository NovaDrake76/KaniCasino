import { useEffect, useState } from "react";
import { FiMessageSquare } from "react-icons/fi";
import ChatPanel from "./ChatPanel";
import i18n from "../../i18n";

const KEY = "kani.chatOpen";
// the games were fitted to 1366x768 in their own right, so the rail cannot simply take
// 300px off them. below this it is an overlay instead, and it starts closed.
const DOCK_WIDTH = 1280;

// the build prerenders these routes, so nothing here may touch window during render
const isWide = () => typeof window !== "undefined" && window.innerWidth >= DOCK_WIDTH;

const readStored = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const useChatDock = () => {
  const [wide, setWide] = useState(isWide);
  const [open, setOpen] = useState(false);

  // read back after mount rather than during render, so the prerendered html and the first
  // client render agree and react does not throw the whole tree away
  useEffect(() => {
    if (isWide() && readStored() === "1") setOpen(true);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const next = isWide();
      setWide(next);
      // a narrow screen never keeps it docked open: it would eat the game board
      if (!next) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = () => {
    setOpen((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // storage blocked: the toggle still works, it just does not survive a reload
      }
      return next;
    });
  };

  return { open, wide, toggle, close: () => setOpen(false) };
};

interface DockProps {
  open: boolean;
  wide: boolean;
  onClose: () => void;
}

// wide screens dock it beside the page and the content shifts. narrow ones get the same
// panel as an overlay, so a phone never has a rail competing with the board.
const ChatDock = ({ open, wide, onClose }: DockProps) => {
  if (!open) return null;

  if (wide) {
    return (
      <div className="sticky top-0 h-screen flex-shrink-0 border-r border-line">
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

export const ChatToggle = ({ onClick, open }: { onClick: () => void; open: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={i18n.t("chat.title")}
    aria-pressed={open}
    className={`flex items-center justify-center p-2 ${open ? "text-accent-gold" : "text-ink-soft hover:text-white"}`}
  >
    <FiMessageSquare className="text-xl" />
  </button>
);

export default ChatDock;
