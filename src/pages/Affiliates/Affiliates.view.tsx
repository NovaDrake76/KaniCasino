import { useState } from "react";
import Skeleton from "react-loading-skeleton";
import { FiCopy } from "react-icons/fi";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import Avatar from "../../components/Avatar";
import { ReferralDashboard, ReferralRow } from "../../services/referrals/ReferralServices";

interface Props {
  userData: any;
  data: ReferralDashboard | null;
  loading: boolean;
  error: boolean;
  saving: boolean;
  claiming: boolean;
  saveCode: (code: string) => void;
  claim: () => void;
  copyLink: () => void;
  link: string;
}

const StatCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="bg-surface rounded-lg p-4 flex flex-col items-center gap-1">
    <span className="text-sm text-ink-muted">{label}</span>
    <span className="text-xl font-semibold text-ink">{children}</span>
  </div>
);

const ReferralTable = ({ referrals }: { referrals: ReferralRow[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-ink-muted">
          <th className="font-medium py-2 pr-4">User</th>
          <th className="font-medium py-2 pr-4">Joined</th>
          <th className="font-medium py-2 pr-4">Total wagered</th>
          <th className="font-medium py-2 pr-4">Commission earned</th>
          <th className="font-medium py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {referrals.map((r) => (
          <tr key={r.id} className="border-t border-line">
            <td className="py-3 pr-4">
              <div className="flex items-center gap-3">
                <Avatar image={r.profilePicture} loading={false} id={r.id} size="small" level={0} />
                <span className="text-ink">{r.username}</span>
              </div>
            </td>
            <td className="py-3 pr-4 text-ink-soft">{new Date(r.joinedAt).toLocaleDateString()}</td>
            <td className="py-3 pr-4 text-ink-soft">
              <Monetary value={r.wagered} />
            </td>
            <td className="py-3 pr-4 text-green-400">
              <Monetary value={r.commission} />
            </td>
            <td className={`py-3 ${r.active ? "text-green-400" : "text-red-400"}`}>
              {r.active ? "Active" : "Inactive"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AffiliatesView: React.FC<Props> = ({
  userData, data, loading, error, saving, claiming, saveCode, claim, copyLink, link,
}) => {
  const [draftCode, setDraftCode] = useState<string>("");

  if (!userData) {
    return <div className="w-full flex justify-center py-16 text-ink-soft">Sign in to refer friends</div>;
  }
  if (loading) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1100px] px-4 py-8">
          <Skeleton height={320} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="w-full flex justify-center py-16 text-ink-muted">Could not load your referrals.</div>;
  }

  const { totals } = data;

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1100px] px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Refer friends</h1>
          <p className="text-ink-muted mt-1">
            You both get <span className="text-accent-gold">+{data.signupBonus} K₽</span> when a friend signs up
            with your link, and you keep earning{" "}
            <span className="text-accent-gold">{Math.round(data.commissionRate * 100)}%</span> of everything they wager.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total earned">
            <span className="text-accent-gold">
              <Monetary value={totals.earned} />
            </span>
          </StatCard>
          <StatCard label="Total wagered by referrals">
            <Monetary value={totals.totalWagered} />
          </StatCard>
          <StatCard label="Referrals">{totals.referralCount}</StatCard>
          <StatCard label="Active this week">
            <span className="text-green-400">{totals.activeCount}</span>
          </StatCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-surface rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-ink font-semibold">Your referral link</h2>
            {data.referralCode ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-nav rounded-md px-3 py-2 text-ink-soft text-sm truncate">{link}</div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 bg-surface-raised hover:bg-surface-hover transition-all rounded-md px-3 py-2 text-ink text-sm"
                >
                  <FiCopy /> Copy
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
                  placeholder="PICKACODE"
                  maxLength={16}
                  className="flex-1 bg-surface-nav rounded-md px-3 py-2 text-ink text-sm focus:outline-none"
                />
                <MainButton text="Save" onClick={() => saveCode(draftCode)} disabled={saving || draftCode.length < 3} loading={saving} />
              </div>
            )}
            <p className="text-xs text-ink-muted">
              {data.referralCode
                ? "Share it anywhere. The code never changes, so old links keep working."
                : "3-16 letters or numbers. Choose well, it cannot be changed later."}
            </p>
          </div>

          <div className="bg-surface rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-ink font-semibold">Available earnings</h2>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold text-green-400">
                <Monetary value={totals.available} />
              </span>
              <MainButton text="Claim" onClick={claim} disabled={claiming || totals.available < 1} loading={claiming} />
            </div>
            <p className="text-xs text-ink-muted">
              Already claimed <Monetary value={totals.claimed} /> in commission.
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-lg p-5">
          <h2 className="text-ink font-semibold mb-3">Your referrals</h2>
          {data.referrals.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center">
              No one yet. Share your link and both of you get paid.
            </p>
          ) : (
            <ReferralTable referrals={data.referrals} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliatesView;
