import { useState } from "react";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { AiOutlineDown, AiOutlineUp } from "react-icons/ai";
import Case from "../../components/Case";

interface CaseListingProps {
  name: string;
  description?: string;
  cases: any;
  loading?: boolean;
  collapsible?: boolean;
  // only the first section sits near the fold; the rest lazy-load their art
  eager?: boolean;
}

// the placeholder mirrors a real card: same w-64, same h-32/md:h-64 art box, same text
// block underneath. it lives in here rather than in the page so the two states cannot
// drift apart, which is what shifted the whole page when the cases arrived.
const CaseSkeleton = () => (
  <div className="w-64 flex flex-col items-center">
    <Skeleton containerClassName="block w-full h-32 md:h-64" height="100%" borderRadius={8} />
    {/* 98px is what the real card's title and price block measures at both breakpoints
        (p-4, a text-lg line, gap-2, the notched price chip). pinning it means the
        placeholder and the card are the same height whatever the skeleton library does */}
    <div className="h-[98px] flex flex-col gap-2 items-center justify-center">
      <Skeleton width={132} height={20} />
      <Skeleton width={84} height={24} />
    </div>
  </div>
);

const collapseKey = (name: string) => `caseSection:${name}`;

const CaseListing: React.FC<CaseListingProps> = ({ name, description, cases, loading, collapsible, eager }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(collapseKey(name)) === "hidden";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(collapseKey(name), next ? "hidden" : "shown");
    } catch {
      // storage may be unavailable; the toggle still works for the session
    }
  };

  return (
    <section className="w-full flex flex-col py-6 items-center" key={name}>
      <div className="flex flex-col w-full max-w-[1600px] px-4">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton width={220} height={26} />
            ) : (
              <>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wide text-white">
                  {name}
                </h2>
                <span className="text-xs font-semibold text-ink-muted bg-surface-raised px-2 py-0.5 rounded">
                  {cases.length}
                </span>
              </>
            )}
          </div>
          {collapsible && !loading && (
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted hover:text-white transition-colors"
            >
              {collapsed ? "Show" : "Hide"}
              {collapsed ? <AiOutlineDown /> : <AiOutlineUp />}
            </button>
          )}
        </div>
        {description && !collapsed && (
          <div className="text-sm text-ink-muted pt-3">{description}</div>
        )}
        {!collapsed && (
          <div className="flex flex-col md:flex-row md:flex-wrap items-center md:items-start justify-center md:justify-start gap-8 pt-6 animate-fade-in">
            {loading
              ? Array(6)
                  .fill(0)
                  .map((_, index) => <CaseSkeleton key={index} />)
              : cases.map((item: any, index: number) => (
                  <Link to={`/case/${item._id}`} key={item._id}>
                    <Case
                      key={item._id}
                      id={item._id}
                      title={item.title}
                      image={item.image}
                      price={item.price}
                      priority={!!eager && index < 4}
                    />
                  </Link>
                ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CaseListing;
