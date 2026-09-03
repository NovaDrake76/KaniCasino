import React, { useContext, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { register, googleLogin, authError, GoogleProfileNeeded } from "../../../services/auth/auth";
import { saveTokens } from "../../../services/auth/authUtils";
import UserContext from "../../../UserContext";
import { getPendingReferralCode, clearPendingReferralCode } from "../../../services/referrals/ReferralServices";
import {
  MAX_NAME,
  SignUpFields,
  isComplete,
  passwordStrength,
  validateSignUp,
} from "../../../services/auth/authRules";
import Field from "../../Field";
import GoogleProfileStep from "./GoogleProfileStep";
import MainButton from "../../MainButton";
import i18n from "../../../i18n";

const STRENGTH_COLOR = ["bg-line", "bg-red-500", "bg-accent-amber", "bg-green-500"];

const SignUpPage: React.FC = () => {
  const [fields, setFields] = useState<SignUpFields>({ nickname: "", email: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof SignUpFields, boolean>>>({});
  const [referralCode, setReferralCode] = useState(getPendingReferralCode());
  // hardly anybody has one, and a field nobody fills pushed the google button below the
  // fold. somebody arriving on a referral link has it already, so theirs stays open.
  const [showReferral, setShowReferral] = useState(!!getPendingReferralCode());
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // set when google verified somebody who has no account yet: nothing exists on the server
  // until they have picked a name and said whether they want their google picture
  const [needsProfile, setNeedsProfile] = useState<GoogleProfileNeeded | null>(null);

  const { toggleLogin } = useContext(UserContext);

  const errors = useMemo(() => validateSignUp(fields), [fields]);
  const strength = passwordStrength(fields.password);

  const set = (key: keyof SignUpFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));
  const blur = (key: keyof SignUpFields) => () => setTouched((prev) => ({ ...prev, [key]: true }));
  const message = (key: keyof SignUpFields) =>
    errors[key] ? i18n.t(`auth.errors.${errors[key]}`) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // a submit marks everything touched, so pressing it on an empty form points at the
    // fields rather than saying nothing at all
    setTouched({ nickname: true, email: true, password: true, confirm: true });
    if (!isComplete(errors) || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await register(
        fields.email.trim(),
        fields.password,
        fields.nickname.trim(),
        referralCode.trim() || undefined,
        marketingOptIn
      );
      saveTokens(response.token, "");
      clearPendingReferralCode();
      toggleLogin();
    } catch (err) {
      setError(authError(err, i18n.t("nav.invalidFormatPleaseTry")));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credentialResponse: { credential?: string }) => {
    setError(null);
    try {
      const code = referralCode.trim() || getPendingReferralCode() || undefined;
      const data = await googleLogin(credentialResponse.credential || "", code, marketingOptIn);
      if (data.needsProfile) return setNeedsProfile(data);
      if (data.token) {
        saveTokens(data.token, "");
        clearPendingReferralCode();
        toggleLogin();
      }
    } catch (err) {
      setError(authError(err, i18n.t("nav.invalidFormatPleaseTry")));
    }
  };

  if (needsProfile) {
    return (
      <GoogleProfileStep
        pending={needsProfile}
        referralCode={referralCode.trim() || undefined}
        marketingOptIn={marketingOptIn}
        onCancel={() => setNeedsProfile(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-ink">{i18n.t("auth.createTitle")}</h2>
        <p className="text-xs text-ink-muted">{i18n.t("auth.createBlurb")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <Field
          id="nickname"
          label={i18n.t("auth.nickname")}
          value={fields.nickname}
          onChange={set("nickname")}
          onBlur={blur("nickname")}
          error={message("nickname")}
          touched={touched.nickname}
          hint={i18n.t("auth.nicknameHint")}
          maxLength={MAX_NAME}
          autoComplete="nickname"
        />
        <Field
          id="email"
          type="email"
          label={i18n.t("auth.emailShort")}
          value={fields.email}
          onChange={set("email")}
          onBlur={blur("email")}
          error={message("email")}
          touched={touched.email}
          autoComplete="email"
        />

        <div className="flex flex-col gap-1">
          <Field
            id="password"
            type="password"
            label={i18n.t("auth.password")}
            value={fields.password}
            onChange={set("password")}
            onBlur={blur("password")}
            error={message("password")}
            touched={touched.password}
            autoComplete="new-password"
          />
          {fields.password && (
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-[3px] flex-1 transition-colors ${strength >= step ? STRENGTH_COLOR[strength] : "bg-line"}`}
                />
              ))}
            </div>
          )}
        </div>

        <Field
          id="confirm"
          type="password"
          label={i18n.t("auth.confirmPassword")}
          value={fields.confirm}
          onChange={set("confirm")}
          onBlur={blur("confirm")}
          error={message("confirm")}
          touched={touched.confirm}
          autoComplete="new-password"
        />
        {showReferral ? (
          <Field
            id="referralCode"
            label={i18n.t("auth.referral")}
            value={referralCode}
            onChange={(value) => setReferralCode(value.toUpperCase())}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="self-start border-none bg-transparent p-0 text-xs text-secondary-light hover:text-white hover:border-none"
          >
            {i18n.t("auth.haveReferral")}
          </button>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span>
            {i18n.t("auth.marketingOptIn")}
            <span className="block text-ink-faint">{i18n.t("auth.marketingOptInHint")}</span>
          </span>
        </label>

        {error && (
          <p role="alert" className="bg-[#3a1f2a] px-3 py-2 text-xs text-[#ffb4b4]">
            {error}
          </p>
        )}

        <MainButton
          text={i18n.t("auth.signUp")}
          onClick={() => undefined}
          disabled={loading}
          loading={loading}
          submit
        />
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">{i18n.t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogle}
          onError={() => setError(i18n.t("nav.invalidFormatPleaseTry"))}
          theme="filled_black"
          text="signup_with"
        />
      </div>
    </div>
  );
};

export default SignUpPage;
