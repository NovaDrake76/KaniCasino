// the balls are coloured by range of five: accent indigo and gold from the palette, then a pink and a teal of their own
export const RANGE_COLORS = ["#4F46E5", "#FFCC00", "#FF6B9A", "#35C9B8"];
export const RANGE_FILLS = ["bg-accent", "bg-accent-gold", "bg-[#FF6B9A]", "bg-[#35C9B8]"];

const rangeOf = (n: number) => Math.min(RANGE_COLORS.length - 1, Math.max(0, Math.floor((n - 1) / 5)));

export const rangeColor = (n: number) => RANGE_COLORS[rangeOf(n)];
export const rangeFill = (n: number) => RANGE_FILLS[rangeOf(n)];
