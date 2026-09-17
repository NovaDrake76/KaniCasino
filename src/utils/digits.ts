// what a whole-number field holds while it is being typed in: digits only, and empty is allowed
export const digitsOnly = (raw: string, maxLength = 7) => raw.replace(/\D/g, "").slice(0, maxLength);

// the typed text as a number inside the bounds, for blur and submit; an empty field falls back
export const clampDigits = (raw: string, min: number, max: number, fallback = min) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};
