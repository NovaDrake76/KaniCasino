import { useEffect, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import i18n from "../../i18n";

export interface CategorySection {
  id: string;
  label: string;
}

interface CategoryBarProps {
  sections: CategorySection[];
  loading?: boolean;
}

// a band just under the bar rather than the whole viewport: the active chip should follow
// the shelf being read, not the tallest one that happens to be on screen
const BAND = "-72px 0px -70% 0px";

// the bar has to clear page content and stay under anything the header opens. both sides of
// that are real bugs already shipped, so the ordering lives in tailwind.config.js and this
// says which layer it is rather than which number.

// index.css still carries the vite starter's global button rules (background, padding, a
// blue hover border and a focus ring that fires on click), so a bare chip opts out of all
// of them and puts the keyboard ring back on focus-visible alone
const CHIP =
  "relative shrink-0 whitespace-nowrap rounded-none border-0 bg-transparent px-0 py-3 text-sm font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light";

const CategoryBar: React.FC<CategoryBarProps> = ({ sections, loading }) => {
  const [active, setActive] = useState<string>("");
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => !!node);
    if (!nodes.length) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // nothing in the band means the reader is between shelves, so the last one stands
        const current = sections.find((section) => visible.has(section.id));
        if (current) setActive(current.id);
      },
      { rootMargin: BAND, threshold: 0 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  // a phone shows three chips of ten, so the strip has to follow the page or the active
  // chip spends most of the scroll off its own edge
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !active || typeof strip.scrollTo !== "function") return;
    const chip = strip.querySelector<HTMLElement>(`[data-section="${CSS.escape(active)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - strip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollTo({ left: left - 16, behavior: "smooth" });
    else if (right > strip.scrollLeft + strip.clientWidth)
      strip.scrollTo({ left: right - strip.clientWidth + 16, behavior: "smooth" });
  }, [active]);

  const jump = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    setActive(id);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!loading && !sections.length) return null;

  return (
    <nav
      aria-label={i18n.t("home.caseCategories")}
      className="sticky top-0 z-sticky w-full border-b border-line bg-surface-nav"
    >
      <div className="w-full max-w-[1600px] mx-auto px-4">
        <div ref={stripRef} className="flex gap-6 md:gap-8 overflow-x-auto">
          {loading
            ? Array(5)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="shrink-0 py-3">
                    <Skeleton width={104} height={20} />
                  </div>
                ))
            : sections.map((section) => {
                const isActive = active === section.id;
                return (
                  <button
                    key={section.id}
                    data-section={section.id}
                    onClick={() => jump(section.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`${CHIP} ${isActive ? "text-white" : "text-ink-muted hover:text-white"}`}
                  >
                    {section.label}
                    <span
                      className={`absolute left-0 right-0 bottom-0 h-[3px] transition-colors ${
                        isActive ? "bg-[#e5308c]" : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
        </div>
      </div>
    </nav>
  );
};

export default CategoryBar;
