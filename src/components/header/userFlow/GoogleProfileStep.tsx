import React, { useContext, useMemo, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { completeGoogleSignup, authError, GoogleProfileNeeded } from "../../../services/auth/auth";
import { saveTokens } from "../../../services/auth/authUtils";
import { clearPendingReferralCode } from "../../../services/referrals/ReferralServices";
import { MAX_NAME, nicknameProblem } from "../../../services/auth/authRules";
import UserContext from "../../../UserContext";
import Field from "../../Field";
import MainButton from "../../MainButton";
import i18n from "../../../i18n";

// what a plain signup gets. shown here as the alternative to google's photo so the choice
// is between two pictures the player can see, rather than between one and a promise.
const DEFAULT_PICTURE = "https://kanicases.s3.amazonaws.com/pfp.png";

interface Props {
  pending: GoogleProfileNeeded;
  referralCode?: string;
  marketingOptIn: boolean;
  onCancel: () => void;
}

const Choice = ({
  src, label, selected, onSelect,
}: { src: string; label: string; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex flex-1 flex-col items-center gap-2 p-3 transition-colors ${
      selected ? "bg-surface-raised" : "bg-surface-nav hover:bg-surface"
    }`}
  >
    <span className="relative">
      <img
        src={src}
        alt=""
        className={`h-16 w-16 rounded-full object-cover ${selected ? "" : "opacity-60"}`}
      />
      {selected && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
          <FiCheck className="text-xs" />
        </span>
      )}
    </span>
    <span className={`text-[11px] font-semibold ${selected ? "text-ink" : "text-ink-muted"}`}>{label}</span>
  </button>
);

// the step between google verifying somebody and the account existing. google hands over a
// real name and a real photo, and a player who wants neither on a public leaderboard had no
// say in it before: the account was made from google's answer the moment they signed in.
const GoogleProfileStep: React.FC<Props> = ({ pending, referralCode, marketingOptIn, onCancel }) => {
  const [nickname, setNickname] = useState(pending.suggested.username || "");
  const [touched, setTouched] = useState(false);
  // google's photo is the one they arrived with, so it starts selected and the default is
  // one click away. nothing is created until they press the button either way.
  const [useGooglePicture, setUseGooglePicture] = useState(!!pending.suggested.picture);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { toggleLogin } = useContext(UserContext);
  const problem = useMemo(() => nicknameProblem(nickname), [nickname]);
  const googlePicture = pending.suggested.picture;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problem || loading) return;

    setLoading(true);
    setError(null);
    try {
      const data = await completeGoogleSignup({
        ticket: pending.ticket,
        username: nickname.trim(),
        useGooglePicture,
        referralCode,
        marketingOptIn,
      });
      saveTokens(data.token, "");
      clearPendingReferralCode();
      toggleLogin();
    } catch (err) {
      setError(authError(err, i18n.t("nav.invalidFormatPleaseTry")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-ink">{i18n.t("auth.finishTitle")}</h2>
        <p className="text-xs text-ink-muted">{i18n.t("auth.finishBlurb")}</p>
      </div>

      {googlePicture && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {i18n.t("auth.picture")}
          </span>
          <div className="flex gap-2">
            <Choice
              src={DEFAULT_PICTURE}
              label={i18n.t("auth.pictureDefault")}
              selected={!useGooglePicture}
              onSelect={() => setUseGooglePicture(false)}
            />
            <Choice
              src={googlePicture}
              label={i18n.t("auth.pictureGoogle")}
              selected={useGooglePicture}
              onSelect={() => setUseGooglePicture(true)}
            />
          </div>
        </div>
      )}

      <Field
        id="nickname"
        label={i18n.t("auth.nickname")}
        value={nickname}
        onChange={setNickname}
        onBlur={() => setTouched(true)}
        error={problem ? i18n.t(`auth.errors.${problem}`) : null}
        touched={touched}
        hint={i18n.t("auth.nicknameGoogleHint")}
        maxLength={MAX_NAME}
        autoComplete="nickname"
      />

      {error && (
        <p role="alert" className="bg-[#3a1f2a] px-3 py-2 text-xs text-[#ffb4b4]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <MainButton
          text={i18n.t("auth.finishButton")}
          onClick={() => undefined}
          disabled={loading}
          loading={loading}
          submit
        />
        <button
          type="button"
          onClick={onCancel}
          className="border-none bg-transparent p-0 text-center text-xs text-ink-muted hover:text-ink-soft hover:border-none"
        >
          {i18n.t("auth.finishCancel")}
        </button>
      </div>
    </form>
  );
};

export default GoogleProfileStep;
