export type Range = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

const HOURS: Record<Range, number> = { "1H": 1, "6H": 6, "1D": 24, "1W": 168, "1M": 720, ALL: 0 };

export const RANGES: Range[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

// keep the points inside the window, plus the last one before it: dropping that would start
// the line at whatever the first trade in the window happened to be rather than where the
// price actually stood when the window opened
export function withinRange<T extends { at: string }>(points: T[], range: Range): T[] {
  const hours = HOURS[range];
  if (!hours) return points;
  const cutoff = Date.now() - hours * 3600000;

  const inside = points.filter((p) => new Date(p.at).getTime() >= cutoff);
  if (inside.length === points.length) return points;

  const before = [...points].reverse().find((p) => new Date(p.at).getTime() < cutoff);
  return before ? [before, ...inside] : inside;
}
