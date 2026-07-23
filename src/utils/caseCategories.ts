export const OTHER_CATEGORY = "Other";

// counter-strike is 42 cases and would otherwise sit first as the newest set, burying
// everything else. pinned categories sort after the date-ordered ones, in this order.
const PINNED_LAST = [OTHER_CATEGORY, "Counter-Strike"];

export const categoryOf = (raw?: string) => (raw || "").trim() || OTHER_CATEGORY;

// -1 for an unpinned category, otherwise its position among the pinned ones
export const pinRank = (category: string) => PINNED_LAST.indexOf(category);

// shared group ordering: pinned categories last, everything else by the caller's rule
export function compareCategories(a: string, b: string, fallback: () => number) {
    const pa = pinRank(a);
    const pb = pinRank(b);
    if (pa !== -1 || pb !== -1) {
        if (pa === -1) return -1;
        if (pb === -1) return 1;
        return pa - pb;
    }
    return fallback();
}
