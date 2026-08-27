// the strip along the bottom of the game container, the way stake puts its controls
// under the canvas rather than floating them over the page. one home for the icons that
// belong to the game itself; more can sit beside the first.
const GameBar = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-1 border-t border-line px-3 py-2">{children}</div>
);

export const GameBarButton = ({
  onClick,
  label,
  active = false,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    aria-pressed={active}
    className={`rounded-none border-0 bg-transparent p-2 text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-light ${
      active ? "text-ink" : "text-ink-faint hover:text-ink-soft"
    }`}
  >
    {children}
  </button>
);

export default GameBar;
