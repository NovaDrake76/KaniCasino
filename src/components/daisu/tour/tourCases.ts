export interface CaseLite {
  _id: string;
  title: string;
  image: string;
  price: number;
  category?: string;
}

// the cheapest case of every category, so the first one is affordable whichever shelf the player likes
export const cheapestPerCategory = (cases: CaseLite[]) => {
  const byCategory = new Map<string, CaseLite>();
  for (const c of cases) {
    const key = c.category || "";
    const held = byCategory.get(key);
    if (!held || c.price < held.price) byCategory.set(key, c);
  }
  return [...byCategory.values()].sort((a, b) => (a.category || "").localeCompare(b.category || ""));
};
