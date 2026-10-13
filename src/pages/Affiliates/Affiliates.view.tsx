import { useState } from "react";
import Skeleton from "react-loading-skeleton";
import { FiCopy } from "react-icons/fi";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import Avatar from "../../components/Avatar";
import { ReferralDashboard, ReferralRow } from "../../services/referrals/ReferralServices";
import i18n from "../../i18n";

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

// the same form as <Monetary />, for amounts that go inside a sentence
const kp = (n: number) => `K₽ ${n.toLocaleString("en-US")}`;

const Rule = ({ amount, children }: { amount: string; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="w-24 shrink-0 text-right font-semibold text-accent-gold">{amount}</span>
    <span>{children}</span>
  </li>
);

const Rules = ({ data }: { data: ReferralDashboard }) => {
  const onAThousand = (type: string) => kp(Math.round(1000 * ((data.houseEdge && data.houseEdge[type]) || 0) * data.commissionShare));
  return (
    <div className="flex flex-col gap-3 text-ink-muted">
      <ul className="flex flex-col gap-1.5 text-sm">
        <Rule amount={`+${kp(data.refereeBonus)}`}>{i18n.t("affiliates.ruleFriend")}</Rule>
        <Rule amount={`+${kp(data.referrerBonus)}`}>{i18n.t("affiliates.ruleVerify")}</Rule>
        <Rule amount={`+${kp(data.milestoneBonus)}`}>
          {i18n.t("affiliates.ruleMilestone", { level: data.milestoneLevel, days: data.milestoneDays })}
        </Rule>
        <Rule amount={`${Math.round(data.commissionShare * 100)}%`}>
          {i18n.t("affiliates.ruleCommission")}{" "}
          <span className="text-ink-faint">
            {i18n.t("affiliates.commissionExample", {
              amount: kp(1000),
              crash: onAThousand("crash_bet"),
              cases: onAThousand("case_open"),
              blackjack: onAThousand("blackjack_bet"),
            })}
          </span>
        </Rule>
      </ul>
      <p className="text-sm">
        {i18n.t("affiliates.verifiedOnly")} {i18n.t("affiliates.ruleReview")}
      </p>
    </div>
  );
};

const standingOf = (r: ReferralRow) => {
  if (r.review === "rejected") return <span className="block text-xs text-red-400">{i18n.t("affiliates.notEligible")}</span>;
  if (r.review === "held") return <span className="block text-xs text-accent-amber">{i18n.t("affiliates.underReview")}</span>;
  if (r.verified === false) return <span className="block text-xs text-accent-amber">{i18n.t("affiliates.waitingVerification")}</span>;
  return null;
};

const ReferralTable = ({ referrals, milestoneLevel, milestoneDays }: { referrals: ReferralRow[]; milestoneLevel: number; milestoneDays: number }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-ink-muted">
          <th className="font-medium py-2 pr-4">{i18n.t("affiliates.user")}</th>
          <th className="font-medium py-2 pr-4">{i18n.t("affiliates.joined")}</th>
          <th className="font-medium py-2 pr-4">{i18n.t("affiliates.level")}</th>
          <th className="font-medium py-2 pr-4">{i18n.t("affiliates.totalWagered")}</th>
          <th className="font-medium py-2 pr-4">{i18n.t("affiliates.commissionEarned")}</th>
          <th className="font-medium py-2">{i18n.t("affiliates.status")}</th>
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
              {r.level}
              {r.milestonePaid ? (
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent-gold/15 text-accent-gold"
                  title={i18n.t("affiliates.reachedLevel", { level: milestoneLevel })}
                >
                  {i18n.t("affiliates.paid")}
                </span>
              ) : (
                <span className="block text-xs text-ink-muted">
                  {i18n.t("affiliates.daysPlayed", { played: Math.min(r.daysPlayed, milestoneDays), total: milestoneDays })}
                </span>
              )}
            </td>
            <td className="py-3 pr-4 text-ink-soft">
              <Monetary value={r.wagered} />
            </td>
            <td className="py-3 pr-4 text-green-400">
              <Monetary value={r.commission} />
              {standingOf(r)}
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
    return <div className="w-full flex justify-center py-16 text-ink-soft">{i18n.t("affiliates.signInToRefer")}</div>;
  }
  if (loading) {
    return (
      <div className="w-full max-w-[1100px]">
        <Skeleton height={320} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="w-full flex justify-center py-16 text-ink-muted">{i18n.t("affiliates.couldNotLoadYour")}</div>;
  }
  if (!data.enabled) {
    return <div className="w-full flex justify-center py-16 text-ink-muted">{i18n.t("affiliates.referralsAreTurnedOff")}</div>;
  }

  const { totals } = data;

  return (
    <div className="w-full max-w-[1100px] flex flex-col gap-6">
        <Rules data={data} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label={i18n.t("affiliates.totalEarned")}>
            <span className="text-accent-gold">
              <Monetary value={totals.earned} />
            </span>
          </StatCard>
          <StatCard label={i18n.t("affiliates.totalWageredByReferrals")}>
            <Monetary value={totals.totalWagered} />
          </StatCard>
          <StatCard label={i18n.t("affiliates.referrals")}>{totals.referralCount}</StatCard>
          <StatCard label={i18n.t("affiliates.activeThisWeek")}>
            <span className="text-green-400">{totals.activeCount}</span>
          </StatCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div data-tour="affiliates-code" className="bg-surface rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-ink font-semibold">{i18n.t("affiliates.yourReferralLink")}</h2>
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
                <MainButton text={i18n.t("affiliates.save")} onClick={() => saveCode(draftCode)} disabled={saving || draftCode.length < 3} loading={saving} />
              </div>
            )}
            <p className="text-xs text-ink-muted">
              {data.referralCode
                ? i18n.t("affiliates.shareItAnywhereThe")
                : "3-16 letters or numbers. Choose well, it cannot be changed later."}
            </p>
          </div>

          <div className="bg-surface rounded-lg p-5 flex flex-col gap-3">
            <h2 className="text-ink font-semibold">{i18n.t("affiliates.availableEarnings")}</h2>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold text-green-400">
                <Monetary value={totals.available} />
              </span>
              <MainButton text={i18n.t("affiliates.claim")} onClick={claim} disabled={claiming || totals.available < 1} loading={claiming} />
            </div>
            <p className="text-xs text-ink-muted">
              Already claimed <Monetary value={totals.claimed} /> in commission.
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-lg p-5">
          <h2 className="text-ink font-semibold mb-3">{i18n.t("affiliates.yourReferrals")}</h2>
          {data.referrals.length === 0 ? (
            <p className="text-ink-muted text-sm py-6 text-center">
              {i18n.t("affiliates.noOneYetShare")}
            </p>
          ) : (
            <ReferralTable referrals={data.referrals} milestoneLevel={data.milestoneLevel} milestoneDays={data.milestoneDays} />
          )}
        </div>
    </div>
  );
};

export default AffiliatesView;
