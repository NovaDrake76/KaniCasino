import routes from "./routes.json";

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

// a page that knows more than its url can call this to refine what PageMeta set.
// prerender bakes the real case name into /case/<id>, and without an override the
// generic dynamic entry would overwrite it the moment react hydrates.
export const applyMeta = (title: string, description: string, pathname: string) => {
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
};
