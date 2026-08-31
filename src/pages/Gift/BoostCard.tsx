import i18n from "../../i18n";

interface CardProps {
  label: string;
  status?: React.ReactNode;
  children: React.ReactNode;
  footValue: string;
  footNote: string;
  live?: boolean;
}

// one shell for all three levers, so they read as a set rather than three panels that
// happen to sit in a row: label and status on top, the lever itself in the middle, and the
// same footer everywhere carrying the one number that lever is currently worth.
const BoostCard = ({ label, status, children, footValue, footNote, live = true }: CardProps) => (
  <div className="notched flex flex-col bg-surface">
    <div className="flex items-center justify-between px-5 pt-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">{label}</span>
      {status}
    </div>

    <div className="flex flex-1 flex-col justify-center px-5 py-5">{children}</div>

    <div className="flex items-baseline gap-2.5 border-t border-line px-5 py-4">
      <span className={`text-2xl font-extrabold leading-none ${live ? "text-accent-gold" : "text-ink-faint"}`}>
        {footValue}
      </span>
      <span className="text-[12px] leading-tight text-ink-soft">{footNote}</span>
    </div>
  </div>
);

export const Chip = ({ tone, children }: { tone: "live" | "muted"; children: React.ReactNode }) => (
  <span
    className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
      tone === "live" ? "bg-accent-gold/15 text-accent-gold" : "bg-surface-nav text-ink-faint"
    }`}
  >
    {children}
  </span>
);

export const betterPrizes = () => i18n.t("gift.betterPrizes");

export default BoostCard;
