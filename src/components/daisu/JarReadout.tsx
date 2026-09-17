import Monetary from "../Monetary";
import i18n from "../../i18n";

interface Props {
  inJar: number;
  full: number;
  fresh: boolean;
  fill: number;
  isFull: boolean;
  untilFull: string;
  fullBonusPct: number;
  pending: number;
  big?: boolean;
}

// the numbers under the jar, shared by the card and the room
const JarReadout = ({ inJar, full, fresh, fill, isFull, untilFull, fullBonusPct, pending, big }: Props) => (
  <div className="flex w-full flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className={`font-bold text-accent-gold ${big ? "text-3xl" : "text-2xl"}`}>
        <Monetary value={inJar} />
      </span>
      {fresh ? (
        <span className="text-xs text-ink-muted">{i18n.t("daisu.ofFull", { full: full.toLocaleString("en-US") })}</span>
      ) : (
        <span className="text-xs text-ink-muted">{i18n.t("daisu.pending", { amount: pending.toLocaleString("en-US") })}</span>
      )}
    </div>
    <div className="h-2 w-full bg-surface-nav">
      <div className="daisu-fill h-full bg-accent-gold" style={{ width: `${Math.round(fill * 100)}%` }} />
    </div>
    <div className="flex items-center justify-between gap-2 text-[11px]">
      {isFull ? (
        <span className="bg-accent-gold px-1.5 py-0.5 font-bold uppercase tracking-wide text-[#2a2100]">
          {i18n.t("daisu.fullBonus", { bonus: fullBonusPct })}
        </span>
      ) : (
        <span className="text-ink-muted">{i18n.t("daisu.fullIn", { clock: untilFull })}</span>
      )}
      <span className="text-ink-muted">{Math.round(fill * 100)}%</span>
    </div>
    <span className="text-[11px] text-ink-faint">{i18n.t("daisu.clickHint")}</span>
  </div>
);

export default JarReadout;
