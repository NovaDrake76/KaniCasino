import { OTHER_CATEGORY, categoryOf, compareCategories } from "../../utils/caseCategories";

export interface CaseGroup {
    category: string;
    id: string;
    cases: any[];
}

export { OTHER_CATEGORY };

// objectids embed creation time, so string order is creation order
const newest = (list: any[]) => list.reduce((a, b) => (a._id < b._id ? b : a))._id;

// the anchor the category bar scrolls to. category names are free text, so the slug is
// deduplicated below rather than trusted to be unique ("Re:Zero" and "Re Zero" collide)
export const sectionSlug = (category: string) =>
    `cases-${categoryOf(category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group"}`;

// cheapest first inside a group, so a shelf reads from what a new player can afford up to
// the premium end; groups are still ordered by their newest case, and no category ->
// "Other", last
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
        newest: newest(list),
        cases: [...list].sort(
            (a, b) => (a.price || 0) - (b.price || 0) || (a._id < b._id ? 1 : -1)
        ),
    }));

    groups.sort((a, b) => compareCategories(a.category, b.category, () => (a.newest < b.newest ? 1 : -1)));

    const taken = new Set<string>();
    return groups.map(({ category, cases }) => {
        const slug = sectionSlug(category);
        let id = slug;
        for (let n = 2; taken.has(id); n += 1) id = `${slug}-${n}`;
        taken.add(id);
        return { category, id, cases };
    });
}
