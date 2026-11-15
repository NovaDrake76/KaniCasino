import type { CSSProperties } from "react";
import { IDLE } from "../../components/daisu/daisuArtFiles";
import type { TicketId } from "./scratchTickets";

// a ticket is drawn as a printed card, so it keeps its own palette rather than the site's: paper, ink and three colours
// per ticket, each one its own colour world on the dark page
export const PAPER = "#fffdf5";
export const INK = "#16233a";
export const CELL = "#f1ecdc";

export interface TicketLook {
  series: string;
  art: string;
  // the strip and the deep end of the face, the light end of the face, and the frame round the scratch zone
  a: string;
  b: string;
  frame: string;
}

export const TICKET_LOOK: Record<TicketId, TicketLook> = {
  pocket: { series: "001", art: IDLE, a: "#0e7c86", b: "#7fe3d4", frame: "#e11d48" },
  nine: { series: "002", art: "/images/cards/cirno.webp", a: "#1c5fa8", b: "#c4ecff", frame: "#2f76de" },
  treasure: { series: "003", art: "/images/cards/marisa.webp", a: "#2b1a52", b: "#f0c14a", frame: "#b45309" },
};

export const lookVars = (look: TicketLook) =>
  ({ "--a": look.a, "--b": look.b, "--frame": look.frame, "--paper": PAPER, "--ink": INK, "--cell": CELL }) as CSSProperties;

// the face of every ticket: a few paper glints over its two colours
export const FACE_BACKGROUND = [
  "radial-gradient(circle at 12% 18%, rgba(255,255,255,.55) 0 3px, transparent 4px)",
  "radial-gradient(circle at 78% 30%, rgba(255,255,255,.4) 0 5px, transparent 6px)",
  "radial-gradient(circle at 55% 82%, rgba(255,255,255,.45) 0 4px, transparent 5px)",
  "radial-gradient(circle at 90% 88%, rgba(255,255,255,.35) 0 7px, transparent 8px)",
  "linear-gradient(160deg, var(--b), var(--a))",
].join(", ");

// the ticket name in the display face, outlined in the ticket's own colour. the face is latin only, so a name in another
// script takes the system's heaviest sans (a thin one vanished into the outline); the weight is never faked on the face itself
export const NAME_STYLE: CSSProperties = {
  fontFamily: '"Alfa Slab One", "Hiragino Sans", "Yu Gothic UI", "Malgun Gothic", "Microsoft YaHei", "Noto Sans CJK JP", system-ui, sans-serif',
  fontWeight: 900,
  fontSynthesis: "none",
  textShadow: "0 2px 0 var(--a), 2px 0 0 var(--a), -2px 0 0 var(--a), 0 -2px 0 var(--a), 0 4px 0 rgba(0,0,0,.25)",
};

export const BARCODE: CSSProperties = {
  background:
    "repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 9px, var(--ink) 9px 12px, transparent 12px 14px)",
};
