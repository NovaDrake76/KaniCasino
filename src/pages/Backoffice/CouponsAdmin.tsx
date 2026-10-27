import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { AdminCoupon, createCoupon, disableCoupon, getCoupons } from "../../services/admin/AdminServices";

const input = "rounded-md bg-surface-raised px-3 py-1.5 text-sm text-ink outline-none";
const fmt = new Intl.NumberFormat("en-US");

const statusOf = (c: AdminCoupon, now: number) =>
  c.disabledAt ? "Off" : Date.parse(c.expiresAt) <= now ? "Expired" : c.redeemed >= c.maxRedemptions ? "Used up" : "Live";

// the bot's daily drops and staff's own codes, newest first; a live one can be switched off from here
const CouponsAdmin = () => {
  const [rows, setRows] = useState<AdminCoupon[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", amount: "500", maxRedemptions: "25", minutes: "60" });

  useEffect(() => {
    let active = true;
    getCoupons()
      .then((r) => active && setRows(r))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, []);

  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("new");
    try {
      const made = await createCoupon({
        amount: Number(draft.amount),
        maxRedemptions: Number(draft.maxRedemptions),
        minutes: Number(draft.minutes),
        code: draft.code.trim() || undefined,
      });
      setRows((current) => [made, ...(current || [])]);
      setDraft((d) => ({ ...d, code: "" }));
      toast.success(`Coupon ${made.code} is live`, { theme: "dark" });
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not make the coupon", { theme: "dark" });
    }
    setBusy(null);
  };

  const switchOff = async (id: string) => {
    setBusy(id);
    try {
      const off = await disableCoupon(id);
      setRows((current) => (current || []).map((r) => (r.id === id ? off : r)));
    } catch {
      toast.error("Could not switch the coupon off", { theme: "dark" });
    }
    setBusy(null);
  };

  const now = Date.now();
  const set = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={make} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Code (blank for random)
          <input value={draft.code} onChange={set("code")} placeholder="DOTOWEEK" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          K₽ each
          <input value={draft.amount} onChange={set("amount")} inputMode="numeric" className={`${input} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Redemptions
          <input value={draft.maxRedemptions} onChange={set("maxRedemptions")} inputMode="numeric" className={`${input} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Minutes
          <input value={draft.minutes} onChange={set("minutes")} inputMode="numeric" className={`${input} w-24`} />
        </label>
        <button type="submit" disabled={busy === "new"} className="rounded-md border-none bg-accent px-3 py-1.5 text-sm text-white hover:border-none disabled:opacity-50">
          Make coupon
        </button>
      </form>

      {!rows ? (
        <Skeleton height={200} borderRadius={8} highlightColor="#161427" baseColor="#1c1a31" />
      ) : !rows.length ? (
        <p className="text-ink-muted text-sm">No coupon yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="font-medium py-2 pr-4">Code</th>
                <th className="font-medium py-2 pr-4">K₽</th>
                <th className="font-medium py-2 pr-4">Redeemed</th>
                <th className="font-medium py-2 pr-4">From</th>
                <th className="font-medium py-2 pr-4">Expires</th>
                <th className="font-medium py-2 pr-4">Status</th>
                <th className="font-medium py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const status = statusOf(c, now);
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-3 pr-4 font-mono text-ink">{c.code}</td>
                    <td className="py-3 pr-4 text-ink-soft">{fmt.format(c.amount)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{`${c.redeemed} / ${c.maxRedemptions}`}</td>
                    <td className="py-3 pr-4 text-ink-muted">{c.source === "discord" ? "Discord drop" : "Staff"}</td>
                    <td className="py-3 pr-4 text-ink-muted">{new Date(c.expiresAt).toLocaleString()}</td>
                    <td className={`py-3 pr-4 ${status === "Live" ? "text-green-400" : "text-ink-muted"}`}>{status}</td>
                    <td className="py-3">
                      {status === "Live" && (
                        <button
                          onClick={() => switchOff(c.id)}
                          disabled={busy === c.id}
                          className="rounded-md border-none bg-surface-raised px-3 py-1.5 text-sm text-ink hover:border-none disabled:opacity-50"
                        >
                          Switch off
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CouponsAdmin;
