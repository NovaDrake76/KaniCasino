import { isNewCase } from "../../utils/caseAge";

// class of 2016 and class of 2022 lead the row while they are new; after that it is the most opened alone
export const PINNED = ["6ab5d8af32243a2ba2e1f9e2", "6ab5d8b332243a2ba2e1fab6"];

// what fits on one line of a wide screen
export const ROW = 5;

export function recommendedCases<T extends { _id: string }>(
    all: T[] | undefined,
    mostOpened: T[],
    pinned = PINNED,
    now = Date.now()
): T[] {
    const byId = new Map((Array.isArray(all) ? all : []).map((c) => [String(c._id), c]));
    const lead = pinned.map((id) => byId.get(id)).filter((c): c is T => !!c && isNewCase(c._id, now));
    const taken = new Set(lead.map((c) => String(c._id)));
    const rest = (mostOpened || []).filter((c) => !taken.has(String(c._id)));
    return [...lead, ...rest].slice(0, ROW);
}
