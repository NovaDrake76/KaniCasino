import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import Monetary from "../../../components/Monetary";
import MainButton from "../../../components/MainButton";
import { rarityColor } from "../../../utils/rarity";
import { CashOutOptions, PooledItem } from "../../../services/poker/PokerService";
import i18n from "../../../i18n";

interface CashOutModalProps {
  open: boolean;
  onClose: () => void;
  options: CashOutOptions | null;
  onSubmit: (picks: string[]) => Promise<void>;
}

const Row = ({
  item,
  picked,
  disabled,
  prize,
  onToggle,
}: {
  item: PooledItem;
  picked: boolean;
  disabled: boolean;
  prize?: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    disabled={disabled && !picked}
    className="notched-sm p-[2px] text-left transition-opacity disabled:opacity-30"
    style={{ backgroundColor: picked ? rarityColor(item.rarity) : "transparent" }}
  >
    <div className="notched-sm flex items-center gap-3 bg-[#212031] p-2">
      <img src={item.image} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{item.name}</div>
        {prize && (
          <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: rarityColor(item.rarity) }}>
            {i18n.t("poker.wonFromTheTable")}
          </div>
        )}
      </div>
      <span className="text-sm font-bold text-[#FFCC00]">
        <Monetary value={item.value} />
      </span>
    </div>
  </button>
);

const CashOutModal = ({ open, onClose, options, onSubmit }: CashOutModalProps) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // your own affordable stake is ticked by default, because walking away from it is never
  // what anybody meant to do
  useEffect(() => {
    if (open && options) setPicked(options.reserved.map((e) => e.uniqueId));
  }, [open, options]);

  const all = useMemo(
    () => [...(options?.reserved || []), ...(options?.open || [])],
    [options]
  );
  const byId = useMemo(() => new Map(all.map((e) => [e.uniqueId, e])), [all]);
  const spent = picked.reduce((sum, id) => sum + (byId.get(id)?.value || 0), 0);
  const left = (options?.stack || 0) - spent;

  const submit = async () => {
    setSending(true);
    await onSubmit(picked);
    setSending(false);
  };

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal open={open} setOpen={() => onClose()} width="min(520px, 95vw)">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{i18n.t("poker.cashOut")}</h2>
          <p className="mt-1 text-xs text-[#84819A]">{i18n.t("poker.cashOutExplainer")}</p>
        </div>

        {!!options?.reserved.length && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#C9C6DE]">{i18n.t("poker.yourStake")}</p>
            {options.reserved.map((item) => (
              <Row
                key={item.uniqueId}
                item={item}
                picked={picked.includes(item.uniqueId)}
                disabled={left < item.value}
                onToggle={() => toggle(item.uniqueId)}
              />
            ))}
          </div>
        )}

        {!!options?.open.length && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#C9C6DE]">{i18n.t("poker.onTheLineNow")}</p>
            {options.open.map((item) => (
              <Row
                key={item.uniqueId}
                item={item}
                prize
                picked={picked.includes(item.uniqueId)}
                disabled={left < item.value}
                onToggle={() => toggle(item.uniqueId)}
              />
            ))}
          </div>
        )}

        <div className="notched-sm flex items-center justify-between bg-[#19172d] px-3 py-2">
          <span className="text-xs font-semibold text-[#84819A]">{i18n.t("poker.paidInKp")}</span>
          <span className="text-lg font-extrabold text-[#FFCC00]">
            <Monetary value={Math.max(0, left)} />
          </span>
        </div>

        <MainButton
          text={i18n.t("poker.leaveTable")}
          onClick={submit}
          disabled={sending || left < 0}
          loading={sending}
        />
      </div>
    </Modal>
  );
};

export default CashOutModal;
