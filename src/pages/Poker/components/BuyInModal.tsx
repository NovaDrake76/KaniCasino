import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/Modal";
import Monetary from "../../../components/Monetary";
import MainButton from "../../../components/MainButton";
import { rarityColor } from "../../../utils/rarity";
import { StakeableItem } from "../../../services/poker/PokerService";
import i18n from "../../../i18n";

interface BuyInModalProps {
  open: boolean;
  onClose: () => void;
  items: StakeableItem[];
  loading: boolean;
  minBuyIn: number;
  maxBuyIn: number;
  bigBlind: number;
  walletBalance: number;
  onSubmit: (kp: number, uniqueIds: string[]) => Promise<void>;
}

// the server priced these off the live catalog, so the modal quotes exactly what the
// stack will be and nobody sits down expecting a different number

const ItemTile = ({
  item,
  picked,
  disabled,
  onToggle,
}: {
  item: StakeableItem;
  picked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    disabled={disabled && !picked}
    className="notched-sm p-[2px] transition-opacity disabled:opacity-30"
    style={{ backgroundColor: picked ? rarityColor(item.rarity) : "transparent" }}
  >
    <div className="notched-sm flex flex-col items-center gap-1 bg-[#212031] p-2">
      <img src={item.image} alt={item.name} className="h-12 w-12 object-contain" />
      <span className="w-full truncate text-center text-[10px] text-[#C9C6DE]">{item.name}</span>
      <span className="text-[10px] font-bold text-[#FFCC00]">
        <Monetary value={item.value} />
      </span>
    </div>
  </button>
);

const BuyInModal = ({
  open,
  onClose,
  items,
  loading,
  minBuyIn,
  maxBuyIn,
  bigBlind,
  walletBalance,
  onSubmit,
}: BuyInModalProps) => {
  const [kp, setKp] = useState(minBuyIn);
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setKp(Math.min(Math.max(minBuyIn, bigBlind * 50), Math.min(maxBuyIn, walletBalance)));
      setPicked([]);
    }
  }, [open, minBuyIn, maxBuyIn, bigBlind, walletBalance]);

  const byId = useMemo(() => new Map(items.map((i) => [i.uniqueId, i])), [items]);
  const itemTotal = picked.reduce((sum, id) => sum + (byId.get(id)?.value || 0), 0);
  const total = kp + itemTotal;
  const valid = total >= minBuyIn && total <= maxBuyIn && kp <= walletBalance && kp >= 0;

  const submit = async () => {
    setSending(true);
    await onSubmit(kp, picked);
    setSending(false);
  };

  return (
    <Modal open={open} setOpen={() => onClose()} width="min(600px, 95vw)">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{i18n.t("poker.takeASeat")}</h2>
          <p className="mt-1 text-xs text-[#84819A]">
            {i18n.t("poker.buyInBetween")} <Monetary value={minBuyIn} /> {i18n.t("poker.and")}{" "}
            <Monetary value={maxBuyIn} />
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[#C9C6DE]" htmlFor="poker-kp">
            {i18n.t("poker.chipsFromWallet")}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="poker-kp"
              type="range"
              min={0}
              max={Math.min(maxBuyIn, walletBalance)}
              step={bigBlind}
              value={kp}
              onChange={(e) => setKp(Number(e.target.value))}
              className="h-1 flex-1 accent-[#4F46E5]"
            />
            <input
              type="number"
              value={kp}
              onChange={(e) => setKp(Math.max(0, Math.floor(Number(e.target.value))))}
              className="notched-xs w-28 bg-[#19172d] px-2 py-1 text-right text-sm font-bold text-white outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#C9C6DE]">{i18n.t("poker.stakeItems")}</p>
          <p className="text-[11px] leading-relaxed text-[#84819A]">{i18n.t("poker.stakeExplainer")}</p>
          {loading ? (
            <p className="py-4 text-center text-sm text-[#84819A]">{i18n.t("common.loading")}</p>
          ) : items.length ? (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {items.map((item) => (
                <ItemTile
                  key={item.uniqueId}
                  item={item}
                  picked={picked.includes(item.uniqueId)}
                  disabled={total + item.value > maxBuyIn}
                  onToggle={() =>
                    setPicked((prev) =>
                      prev.includes(item.uniqueId)
                        ? prev.filter((id) => id !== item.uniqueId)
                        : [...prev, item.uniqueId]
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#625F7E]">{i18n.t("poker.noItemsToStake")}</p>
          )}
        </div>

        <div className="notched-sm flex items-center justify-between bg-[#19172d] px-3 py-2">
          <span className="text-xs font-semibold text-[#84819A]">{i18n.t("poker.yourStack")}</span>
          <span className="text-lg font-extrabold text-[#FFCC00]">
            <Monetary value={total} />
          </span>
        </div>

        <MainButton
          text={i18n.t("poker.sitDown")}
          onClick={submit}
          disabled={!valid || sending}
          loading={sending}
        />
      </div>
    </Modal>
  );
};

export default BuyInModal;
