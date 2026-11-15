// the newest draw a player has watched on this device, so the page plays a missed draw back once and only once
const keyOf = (userId: string) => `lottery.seen.${userId}`;

export const seenDraw = (userId: string): number => {
  try {
    const n = Number(localStorage.getItem(keyOf(userId)));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

export const markSeen = (userId: string, number: number) => {
  try {
    if (seenDraw(userId) < number) localStorage.setItem(keyOf(userId), String(number));
  } catch {
    // private mode or blocked storage: the replay may play again next visit, which is harmless
  }
};
