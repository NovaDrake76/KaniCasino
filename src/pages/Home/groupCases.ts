import { OTHER_CATEGORY, categoryOf, compareCategories } from "../../utils/caseCategories";

export interface CaseGroup {
    category: string;
    cases: any[];
}

export { OTHER_CATEGORY };

// objectids embed creation time, so string order is creation order. newest first
// inside a group, groups ordered by their newest case; no category -> "Other", last
export function groupCasesByCategory(cases: any[]): CaseGroup[] {
    const byCategory = new Map<string, any[]>();
    for (const c of cases || []) {
        if (!c) continue;
        const category = categoryOf(c.category);
        const list = byCategory.get(category) || [];
        if (!list.length) byCategory.set(category, list);
        list.push(c);
    }

    const groups = [...byCategory.entries()].map(([category, list]) => ({
        category,
        cases: [...list].sort((a, b) => (a._id < b._id ? 1 : -1)),
    }));

    groups.sort((a, b) =>
        compareCategories(a.category, b.category, () => (a.cases[0]._id < b.cases[0]._id ? 1 : -1))
    );

    return groups;
}
