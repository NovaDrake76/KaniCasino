import routes from "./routes.json";

// a case page's title depends on what the case is: "cs2 case simulator" is what people
// type for the counter-strike ones, and nobody searches that for touhou. the phrases live
// in routes.json so adding a category is a data change, and scripts/prerender.mjs fills
// the same two templates at build time.
const CATEGORIES: Record<string, string> = routes.categories;

export const casePhrase = (category?: string) =>
  (category && CATEGORIES[category.trim()]) || routes.defaultCategoryPhrase;

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export interface CaseMetaInput {
  title: string;
  price: number;
  category?: string;
}

export const caseMeta = ({ title, price, category }: CaseMetaInput) => {
  const vars = { name: title, price: String(price ?? 0), phrase: casePhrase(category) };
  return {
    title: fill(routes.caseMeta.title, vars),
    description: fill(routes.caseMeta.description, vars),
  };
};
