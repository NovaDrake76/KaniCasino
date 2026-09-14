// the curve the server levels on (backend/utils/economy.js): a level is reached at a total of xp,
// each one a quarter above the last, and level 0 is everything under the first
export const xpForLevel = (level: number) => (level < 1 ? 0 : Math.floor(1000 * Math.pow(1.25, level - 1)));

// how far into its level a total of xp is: 0 at the last level-up, 1 at the next
export const levelProgress = (xp: number, level: number) => {
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - start) / (next - start)));
};
