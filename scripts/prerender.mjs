// bakes real per-route html into dist/ after the vite build.
//
// the crawlers that draw link previews (x, discord, facebook) never run javascript, so
// PageMeta's tags are invisible to them: without this every shared link showed the same
// homepage card. this writes one real html file per route with the tags already in it,
// which also means those urls are files on disk rather than catch-all rewrites, so an
// unknown url can 404 for real.
//
// no headless browser: it copies dist/index.html and swaps the tags, so it costs
// milliseconds and cannot fail the build.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const routes = JSON.parse(readFileSync(join(root, "src/seo/routes.json"), "utf8"));
// same resolution vite itself used for the bundle: .env files locally, real env vars on
// render. reading process.env alone would silently skip case pages on a local build.
const env = loadEnv("production", root, "VITE_");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// \s+ spans newlines, which matters: index.html wraps some tags across two lines
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$2`);
  return html.replace("</head>", `  <meta ${attr}="${key}" content="${esc(value)}" />\n</head>`);
};

const render = (html, { title, description, url, image }) => {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
  out = setMeta(out, "name", "title", title);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", url);
  out = setMeta(out, "property", "og:image", image);
  out = setMeta(out, "property", "twitter:title", title);
  out = setMeta(out, "property", "twitter:description", description);
  out = setMeta(out, "property", "twitter:url", url);
  out = setMeta(out, "property", "twitter:image", image);
  const canonical = `<link rel="canonical" href="${esc(url)}" />`;
  out = /<link\s+rel="canonical"/i.test(out)
    ? out.replace(/<link\s+rel="canonical"[^>]*>/i, canonical)
    : out.replace("</head>", `  ${canonical}\n</head>`);
  return out;
};

// the homepage's largest element is the first case cover, and nothing in the html points
// at it: the browser only finds it once react has rendered the card, which measured as
// ~2.2s of dead "resource load delay". we know the url at build time, so say it up front.
const preloadImage = (html, url) =>
  html.replace(
    "</head>",
    `  <link rel="preload" as="image" href="${esc(url)}" fetchpriority="high" />\n</head>`
  );

// "/" is dist/index.html itself; "/crash" becomes dist/crash/index.html
const write = (route, html) => {
  const dir = route === "/" ? dist : join(dist, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
};

const indexPath = join(dist, "index.html");
if (!existsSync(indexPath)) {
  console.error("prerender: dist/index.html is missing, did vite build run?");
  process.exit(1);
}
const shell = readFileSync(indexPath, "utf8");

let count = 0;
for (const [route, meta] of Object.entries(routes.static)) {
  write(
    route,
    render(shell, {
      title: meta.title,
      description: meta.description,
      url: routes.site + route,
      image: routes.defaultImage,
    })
  );
  count++;
}
console.log(`prerender: ${count} static routes`);

// case pages are the ones people actually paste into discord, so give each one its own
// art and name. best effort by design: the api being down must never fail a deploy, and
// a case added after this build still renders through the /case/* rewrite with the
// generic card.
const base = env.VITE_BASE_URL;
const apiKey = env.VITE_API_KEY;
if (!base) {
  console.log("prerender: no VITE_BASE_URL, skipping case pages (generic card via rewrite)");
} else {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/cases/`, {
      headers: apiKey ? { "x-api-key": apiKey } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cases = await res.json();
    if (!Array.isArray(cases)) throw new Error("unexpected /cases payload");

    // the home page lists cases in the order the api returns them (Home.tsx slices the
    // first six), so the first cover is the one to preload
    const first = cases.find((c) => c?.image);
    if (first) {
      write(
        "/",
        preloadImage(
          render(shell, {
            title: routes.static["/"].title,
            description: routes.static["/"].description,
            url: routes.site + "/",
            image: routes.defaultImage,
          }),
          first.image
        )
      );
      console.log(`prerender: preloading the first cover (${first.title})`);
    }

    let n = 0;
    for (const c of cases) {
      // a case id lands in a filesystem path: anything but plain hex could climb out
      // of dist, and mongo ids are hex anyway, so refuse the rest rather than sanitise
      if (!c?._id || !/^[a-f0-9]{24}$/i.test(String(c._id))) continue;
      const route = `/case/${c._id}`;
      write(
        route,
        render(shell, {
          title: `${c.title} | KaniCasino`,
          description: `Open the ${c.title} on KaniCasino for K₽${c.price}. Provably fair, no real money involved.`,
          url: routes.site + route,
          image: c.image || routes.defaultImage,
        })
      );
      n++;
    }
    console.log(`prerender: ${n} case pages`);
  } catch (err) {
    console.log(`prerender: skipping case pages (${err.message})`);
  }
}
