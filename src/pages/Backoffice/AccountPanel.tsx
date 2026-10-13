import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { AdminAccount, AdminSharedAccount, getAdminAccount, limitAccount, liftLimit } from "../../services/admin/AdminServices";

const REASON_MAX = 300;

const Tag = ({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "bad" | "plain" }) => {
  const colors = {
    good: "bg-green-500/15 text-green-400",
    warn: "bg-accent-amber/15 text-accent-amber",
    bad: "bg-red-500/15 text-red-400",
    plain: "bg-surface-raised text-ink-muted",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs ${colors[tone]}`}>{children}</span>;
};

const SharedRow = ({ account, onOpen }: { account: AdminSharedAccount; onOpen: (id: string) => void }) => (
  <div className="flex items-center gap-2 border-t border-line py-1.5 text-sm first:border-0">
    <button
      type="button"
      onClick={() => onOpen(account.id)}
      className="border-none bg-transparent p-0 text-ink hover:border-none hover:text-accent-light focus:outline-none"
    >
      {account.username}
    </button>
    <span className="text-xs text-ink-muted">lvl {account.level}</span>
    {account.verified ? <Tag tone="good">verified</Tag> : <Tag tone="plain">unverified</Tag>}
    {account.limited && <Tag tone="warn">limited</Tag>}
    {account.disabled && <Tag tone="bad">disabled</Tag>}
    <span className="ml-auto text-xs text-ink-muted">seen {new Date(account.lastAt).toLocaleDateString()}</span>
  </div>
);

// verification, the staff limit and the accounts sharing an address, for deciding on a player under review
const AccountPanel = ({ userId, onOpenPlayer }: { userId: string; onOpenPlayer: (id: string) => void }) => {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setAccount(null);
    setFailed(false);
    getAdminAccount(userId)
      .then((a) => active && setAccount(a))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [userId]);

  if (failed) return <div className="bg-surface rounded-lg p-5 text-sm text-ink-muted">Could not load this account.</div>;
  if (!account) return <Skeleton height={160} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />;

  const apply = async () => {
    setSaving(true);
    try {
      const res = await limitAccount(userId, reason.trim());
      setAccount({ ...account, limited: res.limited });
      setReason("");
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not limit this account", { theme: "dark" });
    }
    setSaving(false);
  };

  const lift = async () => {
    setSaving(true);
    try {
      await liftLimit(userId);
      setAccount({ ...account, limited: null });
    } catch {
      toast.error("Could not lift the limit", { theme: "dark" });
    }
    setSaving(false);
  };

  const { verification, limited, shared } = account;
  const others = new Set(shared.flatMap((s) => s.accounts.map((a) => a.id))).size;

  return (
    <div className="bg-surface rounded-lg p-5 flex flex-col gap-4">
      <h2 className="text-ink font-semibold">Account</h2>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-muted">Verification</span>
        {verification.verified ? <Tag tone="good">verified with {verification.via}</Tag> : <Tag tone="plain">not verified</Tag>}
        {account.disabled && <Tag tone="bad">disabled</Tag>}
        {verification.email && <span className="text-ink-soft">{verification.email}</span>}
      </div>

      {limited ? (
        <div className="flex flex-col gap-2 bg-surface-nav p-3 text-sm">
          <span className="text-accent-amber font-semibold">
            Limited since {new Date(limited.at).toLocaleString()}
            {limited.by?.username ? ` by ${limited.by.username}` : ""}
          </span>
          <span className="text-ink-soft break-words">{limited.reason}</span>
          <button onClick={lift} disabled={saving} className="self-start rounded-md border-none bg-surface-raised px-3 py-1.5 text-sm text-ink hover:border-none disabled:opacity-50">
            Lift the limit
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-ink-muted">
            A limited account keeps playing but cannot trade, chat, join the rain, earn referral rewards or rank. The player sees the reason below.
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder="Reason the player will see"
            rows={2}
            className="w-full resize-none rounded-md bg-surface-nav px-3 py-2 text-sm text-ink outline-none"
          />
          <button
            onClick={apply}
            disabled={saving || !reason.trim()}
            className="self-start rounded-md border-none bg-accent px-3 py-1.5 text-sm text-white hover:border-none disabled:opacity-50"
          >
            Limit the account
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-ink-muted">
          Seen on {account.addresses} address{account.addresses === 1 ? "" : "es"} in the last 90 days
          {shared.length ? `, ${shared.length} shared with ${others} other account${others === 1 ? "" : "s"}` : ", none shared"}. A shared
          address is a lead, not proof: a household, a school or a phone network can put many people behind one.
        </span>
        {shared.map((s) => (
          <div key={s.hash} className="bg-surface-nav p-3">
            <span className="text-xs text-ink-muted">
              address {s.hash} · this account last seen {new Date(s.lastAt).toLocaleDateString()}
            </span>
            <div className="mt-1 flex flex-col">
              {s.accounts.map((a) => (
                <SharedRow key={a.id} account={a} onOpen={onOpenPlayer} />
              ))}
            </div>
            {s.more > 0 && <span className="text-xs text-ink-muted">and {s.more} more</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountPanel;
