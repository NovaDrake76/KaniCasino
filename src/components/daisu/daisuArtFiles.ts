// the drawings her card stacks, and their paths, in one place so the card and the preload agree
export const PART = (name: string) => `/images/daisu/parts/${name}.webp`;

export const PARTS = [
  "base",
  "jar-0", "jar-1", "jar-2", "jar-3", "jar-4",
  "eyes-default", "eyes-smug", "eyes-sharp",
  "mouth-closed", "mouth-open", "mouth-smug",
];

let warmed = false;

// her card used to fetch its nine layers the moment it opened, so the first open always waited on the
// network. they are asked for once the page is idle instead, so she is in the cache before the click
export const preloadDaisuArt = () => {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const run = () => PARTS.forEach((name) => { new Image().src = PART(name); });
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run);
  else w.setTimeout(run, 1000);
};
