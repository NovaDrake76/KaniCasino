// the ladder the server levels on (backend/utils/xpCurve.js): K₽ wagered to reach a level, unboosted,
// as an anchor table, log-linear between anchors and continued at the last slope past the end
const XP_PER_KP = 5;
const ANCHORS: [number, number][] = [
  [1, 40],
  [5, 2500],
  [10, 9000],
  [20, 90000],
  [30, 800000],
  [50, 20000000],
  [75, 300000000],
  [100, 3000000000],
];

const kpForLevel = (level: number) => {
  if (level < 1) return 0;
  for (let i = 0; i + 1 < ANCHORS.length; i++) {
    const [l0, k0] = ANCHORS[i];
    const [l1, k1] = ANCHORS[i + 1];
    if (level <= l1) return Math.exp(Math.log(k0) + ((level - l0) / (l1 - l0)) * (Math.log(k1) - Math.log(k0)));
  }
  const [l0, k0] = ANCHORS[ANCHORS.length - 2];
  const [l1, k1] = ANCHORS[ANCHORS.length - 1];
  return Math.exp(Math.log(k1) + ((level - l1) * (Math.log(k1) - Math.log(k0))) / (l1 - l0));
};

export const xpForLevel = (level: number) => Math.floor(kpForLevel(level) * XP_PER_KP);

// how far into its level a total of xp is: 0 at the last level-up, 1 at the next
export const levelProgress = (xp: number, level: number) => {
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - start) / (next - start)));
};

// the account's xp multiplier from daisu's shop, as a whole percent over the base
export const xpBonusPct = (xpBoost?: { all?: number } | null) => Math.round(((xpBoost?.all ?? 1) - 1) * 100);
