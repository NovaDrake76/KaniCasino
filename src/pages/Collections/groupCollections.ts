import { CollectionSummaryItem } from "../../services/collections/CollectionService";
import { OTHER_CATEGORY, categoryOf, compareCategories } from "../../utils/caseCategories";

export interface CollectionGroup {
    category: string;
    collections: CollectionSummaryItem[];
    slotsOwned: number;
    slotsTotal: number;
    complete: number;
}

export { OTHER_CATEGORY };

// one album shelf per case category. groups keep the server's case order inside them and
// sort by their own completion, so the sets closest to done sit at the top.
export function groupCollectionsByCategory(
    collections: CollectionSummaryItem[]
): CollectionGroup[] {
    const byCategory = new Map<string, CollectionSummaryItem[]>();
    for (const c of collections || []) {
        if (!c) continue;
        const category = categoryOf(c.category);
        const list = byCategory.get(category) || [];
        if (!list.length) byCategory.set(category, list);
        list.push(c);
    }

    const groups = [...byCategory.entries()].map(([category, list]) => ({
        category,
        collections: list,
        slotsOwned: list.reduce((s, c) => s + (c.slotsOwned || 0), 0),
        slotsTotal: list.reduce((s, c) => s + (c.slotsTotal || 0), 0),
        complete: list.filter((c) => c.complete).length,
    }));

    groups.sort((a, b) =>
        compareCategories(a.category, b.category, () => {
            const pa = a.slotsTotal ? a.slotsOwned / a.slotsTotal : 0;
            const pb = b.slotsTotal ? b.slotsOwned / b.slotsTotal : 0;
            return pb - pa || a.category.localeCompare(b.category);
        })
    );

    return groups;
}
