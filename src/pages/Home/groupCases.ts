export interface CaseGroup {
    category: string;
    cases: any[];
}

export const OTHER_CATEGORY = "Other";

// objectids embed creation time, so string order is creation order. newest first
// inside a group, groups ordered by their newest case; no category -> "Other", last
export function groupCasesByCategory(cases: any[]): CaseGroup[] {
    const byCategory = new Map<string, any[]>();
    for (const c of cases || []) {
        if (!c) continue;
        const category = (c.category || "").trim() || OTHER_CATEGORY;
        const list = byCategory.get(category) || [];
        if (!list.length) byCategory.set(category, list);
        list.push(c);
    }

    const groups = [...byCategory.entries()].map(([category, list]) => ({
        category,
        cases: [...list].sort((a, b) => (a._id < b._id ? 1 : -1)),
    }));

    groups.sort((a, b) => {
        if (a.category === OTHER_CATEGORY) return 1;
        if (b.category === OTHER_CATEGORY) return -1;
        return a.cases[0]._id < b.cases[0]._id ? 1 : -1;
    });

    return groups;
}
