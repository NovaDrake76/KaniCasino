import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Monetary from "../../components/Monetary";
import { HeldReferral, getHeldReferrals, reviewReferral } from "../../services/admin/AdminServices";

// a referee seen on their referrer's connection earns them nothing until somebody here decides: one person
// with two accounts is a reject, a household or a dorm is an approve. a decision stands until changed
const ReferralReview: React.FC<{ openPlayer: (id: string) => void }> = ({ openPlayer }) => {
  const [rows, setRows] = useState<HeldReferral[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    getHeldReferrals()
      .then(setRows)
      .catch(() => toast.error("Could not load the held referrals", { theme: "dark" }));

  useEffect(() => {
    load();
  }, []);

  const decide = async (row: HeldReferral, decision: "approved" | "rejected") => {
    setBusy(row.id);
    try {
      const res = await reviewReferral(row.id, decision);
      const paid = [res.paid.bonus && "the signup bonus", res.paid.milestone && "the milestone"].filter(Boolean).join(" and ");
      toast.success(decision === "approved" ? `Approved${paid ? `, paid ${paid}` : ""}` : "Rejected", { theme: "dark" });
      await load();
    } catch {
      toast.error("Could not save that decision", { theme: "dark" });
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return <p className="text-ink-muted text-sm">Loading...</p>;
  if (!rows.length) return <p className="text-ink-muted text-sm">Nobody is waiting for a review.</p>;

  return (
    <div className="flex flex-col">
      <p className="text-xs text-ink-muted mb-2">
        Each referee below was seen on a connection their referrer also used. Their signup bonus, milestone and
        commission wait for a decision here.
      </p>
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-line py-3">
          <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-sm">
            <span className="text-ink truncate">
              <button onClick={() => openPlayer(row.id)} className="bg-transparent p-0 text-ink hover:text-accent-light">{row.username}</button>
              <span className="text-ink-muted"> referred by </span>
              <button onClick={() => openPlayer(row.referrer.id)} className="bg-transparent p-0 text-ink hover:text-accent-light">
                {row.referrer.username || "a deleted account"}
              </button>
            </span>
            <span className="text-xs text-ink-muted">
              Level {row.level} · {row.daysPlayed} {row.daysPlayed === 1 ? "day" : "days"} played · wagered{" "}
              <Monetary value={row.wagered} />
              {!row.verified && " · not verified"}
              {row.bonusPending && " · signup bonus waiting"}
              {row.milestonePaid && " · milestone already paid"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy === row.id}
              onClick={() => decide(row, "approved")}
              className="px-3 py-1.5 rounded bg-surface-raised hover:bg-surface-hover text-ink text-xs disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy === row.id}
              onClick={() => decide(row, "rejected")}
              className="px-3 py-1.5 rounded bg-surface-raised hover:bg-surface-hover text-red-400 text-xs disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReferralReview;
