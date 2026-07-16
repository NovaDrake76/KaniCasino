export type Tab = "inventory" | "collections" | "history" | "missions";

// the url is the source of truth for the tab. owner-only tabs collapse to inventory
// whenever isOwner is false, which covers both "not the owner" and "ownership not
// known yet", so a slow /users/me can never leak them.
export const resolveTab = (param: string | null, isOwner: boolean): Tab =>
  param === "collections"
    ? "collections"
    : (param === "missions" || param === "history") && isOwner
    ? param
    : "inventory";
