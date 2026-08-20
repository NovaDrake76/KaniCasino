import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { IoGameControllerOutline } from "react-icons/io5";
import { FiChevronDown } from "react-icons/fi";
import { gameLinks } from "../gameLinks";
import i18n from "../../../i18n";

const GAP = 12;

// ten games no longer fit across the bar, so they live behind one trigger. two columns,
// because a single column of ten reaches further down the page than the bar is tall.
const GamesMenu = () => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  const games = gameLinks();
  const here = games.some((game) => pathname.startsWith(game.path));

  useEffect(() => setOpen(false), [pathname]);

  // the panel is portalled to the body because the navbar's clip-path would cut off
  // anything hanging below it, fixed positioning included
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const box = trigger.current.getBoundingClientRect();
    setAt({ top: box.bottom + GAP, left: box.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", shut);
    window.addEventListener("scroll", shut, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", shut);
      window.removeEventListener("scroll", shut, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-2 border-0 bg-transparent p-0 text-xs font-normal outline-none 2xl:text-sm"
      >
        <span className={`transition-all ${here || open ? "text-gray-200" : "text-[#625F7E]"}`}>
          <IoGameControllerOutline className="text-2xl" />
        </span>
        <span className="nav-label whitespace-nowrap text-white transition-all hover:text-gray-200">
          {i18n.t("nav.games")}
        </span>
        <FiChevronDown className={`text-[#625F7E] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            style={{ top: at.top, left: at.left }}
            className="notched fixed z-[120] grid grid-cols-2 gap-1 bg-[#212031] p-2 shadow-2xl"
          >
            {games.map((game) => (
              <Link
                to={game.path}
                key={game.path}
                className={`notched-sm flex items-center gap-3 whitespace-nowrap px-3 py-2.5 text-sm transition-all hover:bg-[#281D3F] ${
                  pathname.startsWith(game.path) ? "bg-[#281D3F] text-white" : "text-[#C9C6DE]"
                }`}
              >
                <span className="text-[#625F7E]">{game.icon}</span>
                {game.name}
              </Link>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default GamesMenu;
