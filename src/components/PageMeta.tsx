import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyMeta, resolveMeta } from "../seo/meta";

// keeps title, description and canonical in step with the route. the canonical drops
// the query string on purpose: the profile tab/case/item params are view state, and
// each combination is not its own page.
const PageMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = resolveMeta(pathname);
    applyMeta(title, description, pathname);
  }, [pathname]);

  return null;
};

export default PageMeta;
