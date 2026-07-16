import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import routes from "../seo/routes.json";

interface Meta {
  title: string;
  description: string;
}

const STATIC: Record<string, Meta> = routes.static;

// every route used to report the same title and description with no canonical, which
// reads to a crawler as one page duplicated across the whole site. the same map is
// baked into real html at build time by scripts/prerender.mjs, because the crawlers
// that draw link previews never run this code.
export const resolveMeta = (pathname: string): Meta => {
  const exact = STATIC[pathname];
  if (exact) return exact;
  const dynamic = routes.dynamic.find((d) => new RegExp(d.pattern).test(pathname));
  if (dynamic) return { title: dynamic.title, description: dynamic.description };
  return { title: routes.name, description: routes.defaultDescription };
};

const upsert = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const meta = (property: string, content: string) =>
  upsert(
    `meta[property="${property}"]`,
    () => {
      const m = document.createElement("meta");
      m.setAttribute("property", property);
      return m;
    },
    "content",
    content
  );

// keeps title, description and canonical in step with the route. the canonical drops
// the query string on purpose: the profile tab/case/item params are view state, and
// each combination is not its own page.
const PageMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = resolveMeta(pathname);
    const url = routes.site + pathname;

    document.title = title;

    upsert(
      'meta[name="description"]',
      () => {
        const m = document.createElement("meta");
        m.setAttribute("name", "description");
        return m;
      },
      "content",
      description
    );

    meta("og:title", title);
    meta("og:description", description);
    meta("og:url", url);
    meta("twitter:title", title);
    meta("twitter:description", description);
    meta("twitter:url", url);

    upsert(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement("link");
        l.setAttribute("rel", "canonical");
        return l;
      },
      "href",
      url
    );
  }, [pathname]);

  return null;
};

export default PageMeta;
