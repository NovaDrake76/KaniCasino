interface NavFlareProps {
  active: boolean;
  // keeps the colourless flare up without a pointer, for a menu that is open
  lit?: boolean;
}

// the column of light behind a bar entry and the line on the edge under it. the parent
// carries `group relative`, and 28px is what sits between a 24px entry and the bar's edge.
// 8px of side reach is half the gap between two entries, so neighbouring columns never overlap
const NavFlare: React.FC<NavFlareProps> = ({ active, lit }) => (
  <>
    <span
      aria-hidden
      className={`pointer-events-none absolute -inset-y-7 -left-2 -right-2 transition-opacity duration-200 ${
        active ? "nav-flare opacity-100" : `nav-flare-soft ${lit ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`
      }`}
    />
    <span
      aria-hidden
      className={`pointer-events-none absolute -bottom-7 -left-2 -right-2 h-[2px] transition-colors duration-200 ${
        active ? "bg-accent" : lit ? "bg-line-strong" : "bg-transparent group-hover:bg-line-strong"
      }`}
    />
  </>
);

export default NavFlare;
