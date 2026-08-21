import { useEffect, useState } from "react";
import Modal from "../../../components/Modal";
import Monetary from "../../../components/Monetary";
import { PokerVerify, verifyPokerHand } from "../../../services/fair/FairServices";
import i18n from "../../../i18n";

interface VerifyHandProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  handNumber: number;
}

const Field = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] uppercase tracking-wider text-[#625F7E]">{label}</span>
    <span className="break-all font-mono text-[11px] text-[#C9C6DE]">{value ?? "-"}</span>
  </div>
);

const Cards = ({ cards }: { cards: string[] }) => (
  <span className="font-mono text-xs text-white">{cards.length ? cards.join(" ") : "-"}</span>
);

// a hand is verified whole rather than as one player's roll: the deal is keyed by every
// seated player's client seed, so no single participant could have steered it and there is
// no single roll to look up.
const VerifyHand = ({ open, onClose, tableId, handNumber }: VerifyHandProps) => {
  const [data, setData] = useState<PokerVerify | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tableId || handNumber < 1) return;
    setLoading(true);
    verifyPokerHand(tableId, handNumber)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, tableId, handNumber]);

  return (
    <Modal open={open} setOpen={() => onClose()} width="min(620px, 95vw)">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{i18n.t("poker.verifyTitle", { n: handNumber })}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#84819A]">
            {i18n.t("poker.verifyExplainer")}
          </p>
        </div>

        {loading && <p className="py-6 text-center text-sm text-[#84819A]">{i18n.t("common.loading")}</p>}

        {!loading && data && !data.revealed && (
          <div className="notched-sm flex flex-col gap-2 bg-[#212031] p-3">
            <p className="text-sm text-[#C9C6DE]">{i18n.t("poker.verifyStillLive")}</p>
            <Field label={i18n.t("fair.serverSeedHash")} value={data.serverSeedHash || undefined} />
          </div>
        )}

        {!loading && data && data.revealed && (
          <>
            <div
              className="notched-sm px-3 py-2 text-sm font-bold"
              style={{
                backgroundColor: data.outcomeValid ? "#14532d" : "#7f1d1d",
                color: "#ffffff",
              }}
            >
              {data.outcomeValid ? i18n.t("poker.verifyOk") : i18n.t("poker.verifyFailed")}
            </div>

            <div className="notched-sm flex flex-col gap-2 bg-[#212031] p-3">
              <Field label={i18n.t("fair.serverSeed")} value={data.serverSeed} />
              <Field label={i18n.t("fair.serverSeedHash")} value={data.serverSeedHash || undefined} />
              <Field label={i18n.t("poker.verifyCombinedSeed")} value={data.combinedClientSeed} />
              <Field label={i18n.t("poker.verifyAlgo")} value={data.algoVersion} />
            </div>

            <div className="notched-sm flex flex-col gap-2 bg-[#212031] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#84819A]">
                  {i18n.t("poker.verifyBoard")}
                </span>
                <Cards cards={data.board || []} />
              </div>
              {!data.boardValid && (
                <span className="text-xs text-red-400">{i18n.t("poker.verifyBoardMismatch")}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {(data.players || []).map((p) => (
                <div
                  key={p.seat}
                  className="notched-sm flex items-center justify-between gap-3 bg-[#212031] p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{p.username}</div>
                    <div className="text-[11px] text-[#84819A]">
                      {p.folded ? i18n.t("poker.folded") : <Monetary value={p.wonChips} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cards cards={p.holeCards} />
                    <span
                      className="notched-xs px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                      style={{ backgroundColor: p.matches ? "#14532d" : "#7f1d1d", color: "#fff" }}
                    >
                      {p.matches ? i18n.t("poker.verifyMatch") : i18n.t("poker.verifyMismatch")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !data && (
          <p className="py-4 text-center text-sm text-[#84819A]">{i18n.t("poker.verifyMissing")}</p>
        )}
      </div>
    </Modal>
  );
};

export default VerifyHand;
