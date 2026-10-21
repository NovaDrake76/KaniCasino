import { useEffect, useState } from "react";

// her card at full size, drawn for a 1080p screen at 100% zoom
const CARD_HEIGHT = 620;
// what the navbar and the online count above it take at the top, which stays put in css pixels at any zoom
const TOP = 128;
const MARGIN = 16;
// past this the text gets too small to read, and the card scrolls instead
const MIN_ZOOM = 0.65;

// at 150% zoom or on a 768p laptop her card took the whole height and covered the wallet, so it shrinks as one piece
export const cardZoom = (viewportHeight: number) =>
  Math.max(MIN_ZOOM, Math.min(1, (viewportHeight - TOP - 2 * MARGIN) / CARD_HEIGHT));

// a browser without css zoom keeps the card at full size and only caps its height
const zooms = () => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("zoom", "0.5");

const fitFor = (viewportHeight: number) => {
  const zoom = zooms() ? cardZoom(viewportHeight) : 1;
  // the cap is in the card's own zoomed pixels, so the zoom is divided back out of the window's height
  return { zoom, maxHeight: Math.floor((viewportHeight - 2 * MARGIN) / zoom) };
};

export const useCardFit = (active: boolean) => {
  const [fit, setFit] = useState(() => (typeof window === "undefined" ? { zoom: 1, maxHeight: 0 } : fitFor(window.innerHeight)));

  useEffect(() => {
    if (!active) return;
    const measure = () => setFit(fitFor(window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  return fit;
};
