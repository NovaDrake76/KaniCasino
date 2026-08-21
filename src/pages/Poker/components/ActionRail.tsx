import { useEffect, useMemo, useState } from "react";
import Monetary from "../../../components/Monetary";
import { LegalAction } from "../Table/Table.types";
import i18n from "../../../i18n";

interface ActionRailProps {
  legal: LegalAction[];
  pot: number;
  bigBlind: number;
  acting: boolean;
  onAct: (type: LegalAction["type"], to?: number) => void;
}

// fixed fractions plus a slider. every real poker client offers both because the buttons
// are what players actually use and the slider is what they reach for when the buttons
// are wrong.
const FRACTIONS: { label: string; of: number }[] = [
  { label: "½", of: 0.5 },
  { label: "⅔", of: 0.667 },
  { label: "Pot", of: 1 },
];

const Button = ({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "fold" | "check" | "raise";
}) => {
  const tones = {
    fold: "bg-[#3A365A] hover:bg-[#4a4570]",
    check: "bg-[#281D3F] hover:bg-[#382a55]",
    raise: "bg-[#4F46E5] hover:bg-[#5f56f5]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`notched-sm flex-1 px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 ${tones[tone]}`}
    >
      {label}
    </button>
  );
};

const ActionRail = ({ legal, pot, bigBlind, acting, onAct }: ActionRailProps) => {
  const raise = useMemo(() => legal.find((a) => a.type === "raise" || a.type === "bet"), [legal]);
  const call = useMemo(() => legal.find((a) => a.type === "call"), [legal]);
  const canCheck = legal.some((a) => a.type === "check");
  const canFold = legal.some((a) => a.type === "fold");

  const [amount, setAmount] = useState(raise?.min || 0);

  useEffect(() => {
    if (raise?.min !== undefined) setAmount(raise.min);
  }, [raise?.min, raise?.max]);

  if (!legal.length) {
    return (
      <div className="notched w-full bg-[#212031] px-4 py-5 text-center text-sm text-[#84819A]">
        {i18n.t("poker.waitingForYourTurn")}
      </div>
    );
  }

  const clamp = (value: number) =>
    Math.max(raise?.min || 0, Math.min(raise?.max || 0, Math.floor(value)));

  return (
    <div className="notched flex w-full flex-col gap-3 bg-[#212031] p-3">
      {raise && !raise.allInOnly && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {FRACTIONS.map((f) => (
              <button
                key={f.label}
                onClick={() => setAmount(clamp(pot * f.of))}
                className="notched-xs flex-1 bg-[#281D3F] py-1.5 text-xs font-bold text-[#C9C6DE] transition-all hover:bg-[#382a55]"
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setAmount(raise.max || 0)}
              className="notched-xs flex-1 bg-[#281D3F] py-1.5 text-xs font-bold text-[#C9C6DE] transition-all hover:bg-[#382a55]"
            >
              {i18n.t("poker.allIn")}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={raise.min}
              max={raise.max}
              step={Math.max(1, Math.floor(bigBlind / 2))}
              value={amount}
              onChange={(e) => setAmount(clamp(Number(e.target.value)))}
              className="h-1 flex-1 accent-[#4F46E5]"
              aria-label={i18n.t("poker.raiseTo")}
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(clamp(Number(e.target.value)))}
              className="notched-xs w-24 bg-[#19172d] px-2 py-1 text-right text-sm font-bold text-white outline-none"
              aria-label={i18n.t("poker.raiseTo")}
            />
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {canFold && (
          <Button label={i18n.t("poker.fold")} tone="fold" disabled={acting} onClick={() => onAct("fold")} />
        )}
        {canCheck && (
          <Button label={i18n.t("poker.check")} tone="check" disabled={acting} onClick={() => onAct("check")} />
        )}
        {call && (
          <Button
            tone="check"
            disabled={acting}
            onClick={() => onAct("call")}
            label={
              <span className="flex items-center justify-center gap-1">
                {i18n.t("poker.call")} <Monetary value={call.amount || 0} />
              </span>
            }
          />
        )}
        {raise && (
          <Button
            tone="raise"
            disabled={acting}
            onClick={() => onAct(raise.type, raise.allInOnly ? raise.max : amount)}
            label={
              <span className="flex items-center justify-center gap-1">
                {raise.allInOnly
                  ? i18n.t("poker.allIn")
                  : raise.type === "bet"
                  ? i18n.t("poker.bet")
                  : i18n.t("poker.raiseTo")}{" "}
                <Monetary value={raise.allInOnly ? raise.max || 0 : amount} />
              </span>
            }
          />
        )}
      </div>
    </div>
  );
};

export default ActionRail;
