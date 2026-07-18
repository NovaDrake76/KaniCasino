import Title from "../../components/Title";
import { ProvablyFairViewProps } from "./ProvablyFair.types";

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
    <Title title="Provably Fair" />

    <p className="text-[#84819a] text-sm max-w-[640px] text-center">
      Every case, upgrade, slot and plinko roll is HMAC-SHA256 of your client
      seed, a nonce, and a secret server seed we commit to up front.
    </p>

    {/* roll lookup */}
    <div className="w-full max-w-[900px] flex gap-2">
      <input
        value={rollIdInput}
        onChange={(e) => setRollIdInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && lookup()}
        placeholder="Enter a roll id, e.g. R821872881"
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
            disabled={verifying || (roll.game !== "case" && roll.game !== "plinko")}
            className="px-4 py-1.5 rounded bg-green-700 hover:bg-green-600 text-sm font-semibold disabled:opacity-50"
            title={
              roll.game !== "case" && roll.game !== "plinko"
                ? "Auto-verify supported for case and plinko rolls"
                : ""
            }
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>
        </div>

        <Row label="Client seed" value={roll.clientSeed} />
        <Row label="Server seed hash" value={roll.serverSeedHash} />
        <Row
          label="Server seed"
          value={
            roll.serverSeed || (
              <span className="text-[#84819a]">
                hidden until the seed is rotated
              </span>
            )
          }
        />
        <Row label="Nonce" value={roll.nonce} />
        <Row label="Roll" value={`${roll.roll} / ${roll.total}`} />
        {roll.game === "case" && (
          <>
            <Row label="Item" value={String(roll.itemId)} />
            <Row label="Config version" value={roll.caseConfigVersion} />
            <Row label="Config hash" value={roll.caseConfigHash} />
          </>
        )}
        {!!roll.outcome && (
          <Row
            label="Outcome"
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
                ? `Verified: the recomputed path lands in bin ${verify.recomputedBin} at x${verify.recomputedMultiplier}.`
                : `Verified: recomputed roll ${verify.recomputedRoll} maps to the same item.`
              : `Not verified${verify.reason ? `: ${verify.reason}` : ""}.`}
          </div>
        )}
      </div>
    )}

    {/* seed settings (authenticated) */}
    {seed && (
      <div className="w-full max-w-[900px] bg-[#212031] rounded-lg p-5 flex flex-col gap-3">
        <span className="font-bold text-lg">Your seed</span>
        <Row label="Server seed hash" value={seed.serverSeedHash} />
        <Row label="Nonce" value={seed.nonce} />

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[#84819a]">
            Client seed
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
          {rotating ? "Rotating..." : "Rotate & reveal server seed"}
        </button>

        {revealed && (
          <div className="rounded bg-[#151225] border border-gray-700 p-3 text-sm flex flex-col gap-1">
            <span className="text-yellow-300 font-semibold">
              Previous seed revealed, verify it:
            </span>
            <Row label="Server seed" value={revealed.serverSeed} />
            <Row label="Its hash" value={revealed.serverSeedHash} />
            <Row label="Client seed" value={revealed.clientSeed} />
          </div>
        )}
      </div>
    )}
  </div>
);

export default ProvablyFairView;
