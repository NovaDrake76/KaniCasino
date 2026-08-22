import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Monetary from "../../components/Monetary";
import {
  AdminMarket,
  getAdminMarkets,
  createAdminMarket,
  closeAdminMarket,
  reopenAdminMarket,
  resolveAdminMarket,
  voidAdminMarket,
  updateAdminMarket,
} from "../../services/admin/AdminServices";

const say = (error: unknown, fallback: string) => {
  const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
  toast.error((body && body.message) || fallback, { theme: "dark" });
};

// impact is how far one share moves the price, in basis points. the default of 10 means a
// hundred shares moves it ten points, which is fine for a market nobody is watching and far
// too easy to shove once one is. a market you expect volume on wants a smaller number.
const emptyDraft = {
  title: "",
  description: "",
  image: "",
  category: "General",
  endsAt: "",
  outcomes: "Yes\nNo",
  impactBps: "10",
  exposureCap: "100000",
  boardOrder: "0",
};

const NewMarketForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft({ ...draft, [key]: e.target.value }),
    className: "bg-surface-nav border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-accent w-full",
  });

  const create = async () => {
    const outcomes = draft.outcomes.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!draft.title.trim() || outcomes.length < 2) {
      return toast.error("A market needs a title and at least two outcomes", { theme: "dark" });
    }
    setSaving(true);
    try {
      await createAdminMarket({
        title: draft.title.trim(),
        description: draft.description.trim(),
        image: draft.image.trim() || undefined,
        category: draft.category.trim() || "General",
        endsAt: draft.endsAt || null,
        outcomes,
        impactBps: Number(draft.impactBps) || undefined,
        exposureCap: Number(draft.exposureCap) || undefined,
        boardOrder: Number(draft.boardOrder) || 0,
      });
      setDraft(emptyDraft);
      onCreated();
      toast.success("Market opened", { theme: "dark" });
    } catch (error) {
      say(error, "Could not open that market");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-surface-nav/50 border border-line rounded-lg p-4 mb-4">
      <input placeholder="Title" {...field("title")} />
      <input placeholder="Description" {...field("description")} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2">
          <input placeholder="Image url" {...field("image")} />
          {draft.image.trim() && (
            <img
              src={draft.image.trim()}
              alt=""
              onError={(e) => { e.currentTarget.style.opacity = "0.15"; }}
              onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
              className="w-9 h-9 rounded object-cover object-top bg-surface-nav flex-shrink-0"
            />
          )}
        </div>
        <input placeholder="Category" {...field("category")} />
        <input type="datetime-local" {...field("endsAt")} />
      </div>
      <textarea rows={3} placeholder="One outcome per line" {...field("outcomes")} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Price impact per share (bps)
          <input inputMode="numeric" {...field("impactBps")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Most the house will owe (K₽)
          <input inputMode="numeric" {...field("exposureCap")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Board order (higher floats)
          <input {...field("boardOrder")} />
        </label>
      </div>
      <button
        onClick={create}
        disabled={saving}
        className="self-start px-4 py-2 rounded bg-accent hover:bg-accent-light disabled:opacity-40 text-ink text-sm"
      >
        {saving ? "Opening..." : "Open market"}
      </button>
    </div>
  );
};

const MarketRow: React.FC<{ market: AdminMarket; onChanged: () => void }> = ({ market, onChanged }) => {
  const [outcome, setOutcome] = useState(market.outcomes[0] ? market.outcomes[0].key : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (error) {
      say(error, fallback);
    } finally {
      setBusy(false);
    }
  };

  const settled = market.status === "resolved" || market.status === "void";

  return (
    <div className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-ink text-sm">{market.title}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-raised text-ink-muted uppercase">{market.status}</span>
        <span className="text-[11px] text-ink-faint">{market.category}</span>
        <span className="text-xs text-ink-muted ml-auto">
          <Monetary value={market.volume} /> volume · worst case <Monetary value={market.worstCase} /> / {market.exposureCap}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span>Board order</span>
        <input
          defaultValue={String(market.boardOrder ?? 0)}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next) || next === (market.boardOrder ?? 0)) return;
            run(() => updateAdminMarket(market._id, { boardOrder: next }), "Could not reorder that market");
          }}
          className="bg-surface-nav border border-line rounded px-2 py-1 w-16 text-ink outline-none"
        />
      </div>

      <div className="flex gap-2 flex-wrap text-xs text-ink-muted">
        {market.outcomes.map((o) => (
          <span key={o.key} className="px-2 py-0.5 rounded bg-surface-nav">
            {o.label} {Math.round(o.priceBps / 100)}% · {o.shares} held
          </span>
        ))}
      </div>

      {settled ? (
        <span className="text-xs text-ink-faint">
          {market.status === "void" ? "Cancelled and refunded" : `Resolved to ${market.resolvedOutcome}`}
          {market.resolutionNote ? ` — ${market.resolutionNote}` : ""}
        </span>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          {market.status === "open" ? (
            <button
              onClick={() => run(() => closeAdminMarket(market._id), "Could not close that market")}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-surface-raised hover:bg-surface-hover text-ink text-xs disabled:opacity-40"
            >
              Close
            </button>
          ) : (
            <button
              onClick={() => run(() => reopenAdminMarket(market._id), "Could not reopen that market")}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-surface-raised hover:bg-surface-hover text-ink text-xs disabled:opacity-40"
            >
              Reopen
            </button>
          )}

          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="bg-surface-nav border border-line rounded px-2 py-1.5 text-xs text-ink outline-none"
          >
            {market.outcomes.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why (shown to players)"
            className="bg-surface-nav border border-line rounded px-2 py-1.5 text-xs text-ink outline-none flex-1 min-w-[160px]"
          />

          <button
            onClick={() => run(() => resolveAdminMarket(market._id, outcome, note), "Could not resolve that market")}
            disabled={busy || !outcome}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-ink text-xs disabled:opacity-40"
          >
            Resolve
          </button>
          <button
            onClick={() => run(() => voidAdminMarket(market._id, note), "Could not cancel that market")}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-ink text-xs disabled:opacity-40"
          >
            Cancel and refund
          </button>
        </div>
      )}
    </div>
  );
};

const PredictionsAdmin: React.FC = () => {
  const [markets, setMarkets] = useState<AdminMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminMarkets()
      .then((rows) => active && setMarkets(rows))
      .catch(() => active && setMarkets([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloads]);

  const reload = () => setReloads((n) => n + 1);

  return (
    <div>
      <NewMarketForm onCreated={reload} />
      {loading ? (
        <span className="text-sm text-ink-muted">Loading markets...</span>
      ) : markets.length === 0 ? (
        <span className="text-sm text-ink-muted">No markets yet.</span>
      ) : (
        markets.map((market) => <MarketRow key={market._id} market={market} onChanged={reload} />)
      )}
    </div>
  );
};

export default PredictionsAdmin;
