import { useEffect, useState } from "react";

// a real breakpoint, not a css one. some layouts cannot reflow with css alone: the poker
// seat ring becomes a vertical stack on a phone, and rendering both and hiding one would
// mount the board twice and run its animations twice.
//
// matchMedia is missing in jsdom and in the prerender step, so every use of it is guarded
// rather than assumed; without a window the answer is simply "no match".
const listFor = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : null;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => listFor(query)?.matches ?? false);

  useEffect(() => {
    const list = listFor(query);
    if (!list) return;
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// tailwind's lg
export const useIsWide = () => useMediaQuery("(min-width: 1024px)");
