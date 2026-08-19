import Title from "../../components/Title";
import { ProvablyFairViewProps } from "./ProvablyFair.types";
import i18n from "../../i18n";

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-[#2a2840] py-2">
    <span className="text-xs uppercase tracking-wider text-[#84819a] sm:w-40 shrink-0">
      {label}
    </span>
    <span className="text-sm break-all">{value}</span>
  </div>
);

const ProvablyFairView: React.FC<ProvablyFairViewProps> = ({
  seed,
  clientSeedInput,
  setClientSeedInput,
  savingSeed,
  saveClientSeed,
  rotating,
  rotate,
  revealed,
  rollIdInput,
  setRollIdInput,
  roll,
  lookingUp,
  lookup,
  verify,
  verifying,
  doVerify,
}) => (
  <div className="w-screen flex flex-col items-center py-8 gap-6 px-4">
    <Title title={i18n.t("footer.provablyFair")} />

    <p className="text-[#84819a] text-sm max-w-[640px] text-center">
      {i18n.t("fair.everyCaseUpgradeSlot")}
    </p>

    {/* roll lookup */}
    <div className="w-full max-w-[900px] flex gap-2">
      <input
        value={rollIdInput}
        onChange={(e) => setRollIdInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && lookup()}
        placeholder={i18n.t("fair.enterARollId")}
        className="flex-1 bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded px-3 py-2 text-sm"
      />
      <button
        onClick={() => lookup()}
        disabled={lookingUp}
        className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm disabled:opacity-50"
      >
        {lookingUp ? "..." : "Check"}
      </button>
    </div>

    {roll && (
      <div className="w-full max-w-[900px] bg-[#212031] rounded-lg p-5 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold">
            {roll.rollId}{" "}
            <span className="text-[#84819a] text-sm">· {roll.game}</span>
          </span>
          <button
            onClick={doVerify}
            disabled={verifying || (roll.game !== "case" && roll.game !== "plinko" && roll.game !== "blackjack" && roll.game !== "dice" && roll.game !== "mines" && roll.game !== "hilo")}
            className="px-4 py-1.5 rounded bg-green-700 hover:bg-green-600 text-sm font-semibold disabled:opacity-50"
            title={
              roll.game !== "case" && roll.game !== "plinko" && roll.game !== "blackjack" && roll.game !== "dice" && roll.game !== "mines" && roll.game !== "hilo"
                ? i18n.t("fair.autoVerifySupportedFor")
                : ""
            }
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>
        </div>

        <Row label={i18n.t("fair.clientSeed")} value={roll.clientSeed} />
        <Row label={i18n.t("fair.serverSeedHash")} value={roll.serverSeedHash} />
        <Row
          label={i18n.t("fair.serverSeed")}
          value={
            roll.serverSeed || (
              <span className="text-[#84819a]">
                {i18n.t("fair.hiddenUntilTheSeed")}
              </span>
            )
          }
        />
        <Row label={i18n.t("fair.nonce")} value={roll.nonce} />
        <Row label={i18n.t("fair.roll")} value={`${roll.roll} / ${roll.total}`} />
        {roll.game === "case" && (
          <>
            <Row label={i18n.t("fair.item")} value={String(roll.itemId)} />
            <Row label={i18n.t("fair.configVersion")} value={roll.caseConfigVersion} />
            <Row label={i18n.t("fair.configHash")} value={roll.caseConfigHash} />
          </>
        )}
        {!!roll.outcome && (
          <Row
            label={i18n.t("fair.outcome")}
            value={
              <code className="text-xs">{JSON.stringify(roll.outcome)}</code>
            }
          />
        )}

        {verify && (
          <div
            className={`mt-3 rounded p-3 text-sm ${
              verify.ok
                ? "bg-green-500/10 text-green-300"
                : "bg-red-500/10 text-red-300"
            }`}
          >
            {verify.ok
              ? verify.recomputedPath
                ? i18n.t("fair.verifiedPlinko", {
                    bin: verify.recomputedBin,
                    multiplier: verify.recomputedMultiplier,
                  })
                : verify.recomputedDealerCards
                  ? i18n.t("fair.verifiedBlackjack", {
                      player: verify.recomputedPlayerCards?.length,
                      dealer: verify.recomputedDealerCards.length,
                      total: verify.recomputedDealerTotal,
                      outcome: verify.recomputedOutcome,
                      payout: verify.recomputedPayout,
                    })
                  : verify.recomputedResult !== undefined
                    ? i18n.t("fair.verifiedDice", {
                        result: verify.recomputedResult,
                        outcome: i18n.t(verify.recomputedWon ? "fair.win" : "fair.loss"),
                        multiplier: verify.recomputedMultiplier,
                        payout: verify.recomputedPayout,
                      })
                    : verify.recomputedMineSet
                      ? i18n.t("fair.verifiedMines", {
                          mines: verify.recomputedMineSet.join(", "),
                          gems: verify.recomputedGems,
                          outcome: i18n.t(verify.recomputedBusted ? "fair.busted" : "fair.cashed"),
                          payout: verify.recomputedPayout,
                        })
                      : verify.recomputedCards
                        ? i18n.t("fair.verifiedHilo", {
                            cards: verify.recomputedCards.join(", "),
                            correct: verify.recomputedGuesses,
                            outcome: i18n.t(verify.recomputedBusted ? "fair.busted" : "fair.cashed"),
                            payout: verify.recomputedPayout,
                          })
                        : i18n.t("fair.verifiedCase", { roll: verify.recomputedRoll })
              : verify.reason
                ? i18n.t("fair.notVerifiedReason", { reason: verify.reason })
                : i18n.t("fair.notVerified")}
          </div>
        )}
      </div>
    )}

    {/* seed settings (authenticated) */}
    {seed && (
      <div className="w-full max-w-[900px] bg-[#212031] rounded-lg p-5 flex flex-col gap-3">
        <span className="font-bold text-lg">{i18n.t("fair.yourSeed")}</span>
        <Row label={i18n.t("fair.serverSeedHash")} value={seed.serverSeedHash} />
        <Row label={i18n.t("fair.nonce")} value={seed.nonce} />

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[#84819a]">
            {i18n.t("fair.clientSeed")}
          </span>
          <div className="flex gap-2">
            <input
              value={clientSeedInput}
              onChange={(e) => setClientSeedInput(e.target.value)}
              className="flex-1 bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded px-3 py-2 text-sm"
            />
            <button
              onClick={saveClientSeed}
              disabled={savingSeed}
              className="px-4 py-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] text-sm font-semibold disabled:opacity-50"
            >
              {savingSeed ? "..." : "Save"}
            </button>
          </div>
        </div>

        <button
          onClick={rotate}
          disabled={rotating}
          className="self-start px-5 py-2 rounded bg-pink-700 hover:bg-pink-600 font-semibold text-sm disabled:opacity-50"
        >
          {rotating ? "Rotating..." : i18n.t("fair.rotateRevealServerSeed")}
        </button>

        {revealed && (
          <div className="rounded bg-[#151225] border border-gray-700 p-3 text-sm flex flex-col gap-1">
            <span className="text-yellow-300 font-semibold">
              {i18n.t("fair.previousSeedRevealedVerify")}
            </span>
            <Row label={i18n.t("fair.serverSeed")} value={revealed.serverSeed} />
            <Row label={i18n.t("fair.itsHash")} value={revealed.serverSeedHash} />
            <Row label={i18n.t("fair.clientSeed")} value={revealed.clientSeed} />
          </div>
        )}
      </div>
    )}
  </div>
);

export default ProvablyFairView;
