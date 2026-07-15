interface Props {
  owned: number;
  total: number;
  pct: number;
  className?: string;
}

const CompletionBar: React.FC<Props> = ({ owned, total, pct, className }) => {
  const complete = total > 0 && owned >= total;
  return (
    <div className={`flex flex-col gap-1 ${className || ""}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">
          {owned}/{total} items
        </span>
        <span className={complete ? "text-accent-gold font-semibold" : "text-ink-soft font-semibold"}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-nav overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${complete ? "bg-accent-gold" : "bg-accent"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

export default CompletionBar;
