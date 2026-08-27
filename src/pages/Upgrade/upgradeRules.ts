// mirrors backend/games/upgrade.js exactly, so the rate on screen is the rate the server
// rolls: p = RTP(targetRarity) * staked / target, capped by the rarity ceiling.
// upgradeConstants.test.ts reads both files and fails if these two ever disagree.
export const UPGRADE_RTP_BY_RARITY: { [k: string]: number } = { "1": 0.9, "2": 0.9, "3": 0.85, "4": 0.75, "5": 0.3 };
export const UPGRADE_CEILING: { [k: string]: number } = { "1": 0.9, "2": 0.7, "3": 0.45, "4": 0.25, "5": 0.12 };
export const UPGRADE_MAX_RARITY_GAP = 2;

export const ALL_RARITIES = [1, 2, 3, 4, 5];

const between = (lo: number, hi: number) => ALL_RARITIES.filter((r) => r >= lo && r <= hi);

const rarityOf = (thing: any) => Number(thing?.item?.rarity ?? thing?.rarity) || 0;

// a staked item has to sit at or below the target and no further than the gap under it, so
// the pile pins the target to [highest staked, lowest staked + gap]
export const targetRarities = (selectedItems: any[]): number[] => {
    let lo = 1;
    let hi = 5;
    for (const selected of selectedItems) {
        const rarity = rarityOf(selected);
        if (!rarity) continue;
        lo = Math.max(lo, rarity);
        hi = Math.min(hi, rarity + UPGRADE_MAX_RARITY_GAP);
    }
    return between(lo, hi);
};

// the same rule read backwards: what may still be staked, given the target if one is picked
// and whatever is already in the pile
export const sourceRarities = (selectedItems: any[], selectedTarget: any): number[] => {
    let lo = 1;
    let hi = 5;
    const target = rarityOf(selectedTarget);
    if (target) {
        lo = Math.max(lo, target - UPGRADE_MAX_RARITY_GAP);
        hi = Math.min(hi, target);
    }
    for (const selected of selectedItems) {
        const rarity = rarityOf(selected);
        if (!rarity) continue;
        // whatever joins has to leave a target the whole pile can still reach
        lo = Math.max(lo, rarity - UPGRADE_MAX_RARITY_GAP);
        hi = Math.min(hi, rarity + UPGRADE_MAX_RARITY_GAP);
    }
    const allowed = between(lo, hi);
    return allowed.length ? allowed : ALL_RARITIES;
};

export const calculateSuccessRate = (selectedItems: any[], target: any) => {
    const stakedValue = selectedItems.reduce(
        (sum: number, selected: any) => sum + (selected.item?.baseValue || 0),
        0
    );
    const targetValue = target?.baseValue || 0;
    if (stakedValue <= 0 || targetValue <= 0) return 0;
    // the server refuses this combination, so quoting a rate for it would be a lie
    const reachable = targetRarities(selectedItems);
    if (!reachable.includes(Number(target?.rarity))) return 0;
    const rtp = UPGRADE_RTP_BY_RARITY[String(target?.rarity)] || 0.9;
    const ceiling = UPGRADE_CEILING[String(target?.rarity)] || 0.9;
    return Math.min((rtp * stakedValue) / targetValue, ceiling);
};
