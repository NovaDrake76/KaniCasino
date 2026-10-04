import { useContext, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import UserContext from "../../UserContext";
import Field from "../../components/Field";
import MainButton from "../../components/MainButton";
import { changeEmail, problemOf, Verification } from "../../services/account/AccountService";
import { openVerify } from "../../components/verify/verifyEvents";
import { lockDate } from "../../components/verify/useVerification";
import i18n from "../../i18n";

// the account's verification, and the way to fix an address that cannot receive the link
const AccountSettings = () => {
  const { userData } = useContext(UserContext);
  const v: Verification | undefined = userData?.verification;
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  if (!v) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !email.trim()) return;
    setSaving(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await changeEmail(email.trim(), password);
      setSentTo(res.to || email.trim());
      setEditing(false);
      setPassword("");
    } catch (err) {
      const problem = problemOf(err);
      setError(i18n.t(`verify.errors.${problem.reason || "failed"}`));
      setSuggestion(problem.suggestion);
    }
    setSaving(false);
  };

  return (
    <>
      <span className="text-lg font-bold">{i18n.t("verify.settings.title")}</span>

      <div className="flex flex-col gap-4 bg-surface border border-line rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{i18n.t("verify.settings.status")}</span>
            {v.verified ? (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <FiCheckCircle /> {i18n.t("verify.verified")} {v.via && `(${i18n.t(`verify.via.${v.via}`)})`}
              </span>
            ) : (
              <span className="text-sm text-ink-muted">
                {i18n.t("verify.settings.notVerified", { date: lockDate(new Date(v.requiredFrom)) })}
              </span>
            )}
          </div>
          {!v.verified && (
            <div className="shrink-0">
              <MainButton text={i18n.t("verify.button")} onClick={openVerify} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">{i18n.t("verify.settings.email")}</span>
              <span className="truncate text-sm text-ink-soft">{v.email}</span>
            </div>
            {v.canChangeEmail && !editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSentTo(null);
                }}
                className="shrink-0 rounded-none border-0 bg-transparent p-0 text-sm font-semibold text-secondary-light hover:text-white focus:outline-none"
              >
                {i18n.t("verify.settings.change")}
              </button>
            )}
          </div>
          {!v.canChangeEmail && <span className="text-xs text-ink-muted">{i18n.t("verify.errors.google")}</span>}
          {sentTo && <span className="text-sm text-green-400">{i18n.t("verify.settings.changeSent", { email: sentTo })}</span>}

          {editing && (
            <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
              <Field id="new-email" type="email" label={i18n.t("verify.settings.newEmail")} value={email} onChange={setEmail} autoComplete="email" />
              <Field id="current-password" type="password" label={i18n.t("verify.settings.password")} value={password} onChange={setPassword} autoComplete="current-password" />
              {error && <span className="text-sm text-red-400">{error}</span>}
              {suggestion && (
                <button type="button" onClick={() => setEmail(suggestion)} className="self-start rounded-none border-0 bg-transparent p-0 text-left text-sm font-semibold text-secondary-light hover:text-white focus:outline-none">
                  {i18n.t("verify.suggestion", { email: suggestion })}
                </button>
              )}
              <div className="flex items-center gap-3">
                <MainButton text={i18n.t("verify.settings.sendChange")} onClick={() => undefined} loading={saving} disabled={saving || !email.trim()} submit />
                <button type="button" onClick={() => setEditing(false)} className="rounded-none border-0 bg-transparent p-0 text-sm text-ink-muted hover:text-white focus:outline-none">
                  {i18n.t("verify.settings.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default AccountSettings;
