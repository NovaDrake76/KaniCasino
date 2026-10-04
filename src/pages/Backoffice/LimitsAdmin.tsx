import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { AdminLimitedRow, getLimitedAccounts, liftLimit } from "../../services/admin/AdminServices";

// every account staff have limited, newest first, so a review can be picked up or ended from one place
const LimitsAdmin = ({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) => {
  const [rows, setRows] = useState<AdminLimitedRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLimitedAccounts()
      .then((r) => active && setRows(r))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, []);

  const lift = async (id: string) => {
    setBusy(id);
    try {
      await liftLimit(id);
      setRows((current) => (current || []).filter((r) => r.id !== id));
    } catch {
      toast.error("Could not lift the limit", { theme: "dark" });
    }
    setBusy(null);
  };

  if (!rows) return <Skeleton height={200} borderRadius={8} highlightColor="#161427" baseColor="#1c1a31" />;
  if (!rows.length) return <p className="text-ink-muted text-sm">No account is limited.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-ink-muted">
            <th className="font-medium py-2 pr-4">User</th>
            <th className="font-medium py-2 pr-4">Reason</th>
            <th className="font-medium py-2 pr-4">By</th>
            <th className="font-medium py-2 pr-4">Since</th>
            <th className="font-medium py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="py-3 pr-4">
                <button type="button" onClick={() => onOpenPlayer(r.id)} className="border-none bg-transparent p-0 text-ink hover:border-none hover:text-accent-light focus:outline-none">
                  {r.username}
                </button>
                <span className="ml-2 text-xs text-ink-muted">lvl {r.level}</span>
              </td>
              <td className="py-3 pr-4 text-ink-soft break-words max-w-md">{r.limited.reason}</td>
              <td className="py-3 pr-4 text-ink-muted">{r.limited.by?.username || "-"}</td>
              <td className="py-3 pr-4 text-ink-muted">{new Date(r.limited.at).toLocaleDateString()}</td>
              <td className="py-3">
                <button
                  onClick={() => lift(r.id)}
                  disabled={busy === r.id}
                  className="rounded-md border-none bg-surface-raised px-3 py-1.5 text-sm text-ink hover:border-none disabled:opacity-50"
                >
                  Lift
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LimitsAdmin;
