// which navbar entry the current url belongs to. a link may carry a query of its own
// (missions is a tab on the profile), and then the query has to match as well as the path
export const isCurrent = (pathname: string, search: string, path: string): boolean => {
  const [base, query] = path.split("?");
  if (base !== "/" && !(pathname === base || pathname.startsWith(`${base}/`))) return false;
  if (base === "/" && pathname !== "/") return false;
  if (!query) return true;
  const here = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([key, value]) => here.get(key) === value);
};
