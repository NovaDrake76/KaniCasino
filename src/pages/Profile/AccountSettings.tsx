import { useContext, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import UserContext from "../../UserContext";
import Field from "../../components/Field";
import MainButton from "../../components/MainButton";
import { changeEmail, problemOf, Verification } from "../../services/account/AccountService";
import { openVerify } from "../../components/verify/verifyEvents";
import SettingsCard from "./SettingsCard";
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

  const badge = v.verified ? (
    <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400">
      <FiCheckCircle /> {i18n.t("verify.settings.verified")}
    </span>
  ) : (
    <span className="text-sm text-ink-muted">{i18n.t("verify.settings.notVerified")}</span>
  );

  const footer = editing ? (
    <>
      <button type="button" onClick={() => setEditing(false)} className="rounded-none border-0 bg-transparent p-0 text-sm text-ink-muted hover:text-white focus:outline-none">
        {i18n.t("verify.settings.cancel")}
      </button>
      <div className="min-w-[10rem]">
        <MainButton text={i18n.t("verify.settings.sendChange")} onClick={() => undefined} loading={saving} disabled={saving || !email.trim()} submit />
      </div>
    </>
  ) : v.canChangeEmail || !v.verified ? (
    <>
      {v.canChangeEmail && (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setSentTo(null);
          }}
          className="h-10 rounded-md border border-line bg-surface-nav px-4 font-semibold text-white transition-colors hover:border-line-strong hover:bg-line focus:outline-none"
        >
          {i18n.t("verify.settings.change")}
        </button>
      )}
      {!v.verified && (
        <div className="min-w-[10rem]">
          <MainButton text={i18n.t("verify.button")} onClick={openVerify} />
        </div>
      )}
    </>
  ) : undefined;

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard title={i18n.t("verify.settings.email")} badge={badge} footer={footer}>
        <div className="truncate border-b-2 border-line bg-surface-nav px-3 py-2.5 text-sm text-ink-soft">{v.email}</div>
        {sentTo && <span className="text-sm text-green-400">{i18n.t("verify.settings.changeSent", { email: sentTo })}</span>}

        {editing && (
          <>
            <Field id="new-email" type="email" label={i18n.t("verify.settings.newEmail")} value={email} onChange={setEmail} autoComplete="email" />
            <Field id="current-password" type="password" label={i18n.t("verify.settings.password")} value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <span className="text-sm text-red-400">{error}</span>}
            {suggestion && (
              <button type="button" onClick={() => setEmail(suggestion)} className="self-start rounded-none border-0 bg-transparent p-0 text-left text-sm font-semibold text-secondary-light hover:text-white focus:outline-none">
                {i18n.t("verify.suggestion", { email: suggestion })}
              </button>
            )}
          </>
        )}
      </SettingsCard>
    </form>
  );
};

export default AccountSettings;
