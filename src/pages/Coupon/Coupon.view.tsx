import { FaDiscord } from "react-icons/fa";
import Field from "../../components/Field";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import { CouponViewProps } from "./Coupon.types";
import i18n from "../../i18n";

const t = (key: string) => i18n.t(`coupon.${key}`);

const problemText = (problem: string) =>
  problem === "verify" ? i18n.t("verify.locked.coupon") : problem === "limited" ? i18n.t("limited.coupon") : t(`errors.${problem}`);

const CouponView: React.FC<CouponViewProps> = ({ code, setCode, state, submit, logIn, discordUrl }) => (
  <div className="flex w-full justify-center px-4 py-12 md:py-16">
    <div className="flex w-full max-w-md flex-col gap-5 bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-xl font-bold">{t("title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-ink-soft">{t("intro")}</p>
        <a href={discordUrl} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 text-sm font-semibold text-accent-light hover:text-white">
          <FaDiscord /> {t("discord")}
        </a>
      </div>

      {state.kind === "done" ? (
        <div className="flex flex-col items-center gap-1 bg-surface-nav px-4 py-6 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("doneTitle")}</span>
          <span className="text-3xl font-extrabold text-accent-gold">
            +<Monetary value={state.amount} />
          </span>
          <span className="text-sm text-ink-soft">{t("done")}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field
            id="coupon-code"
            label={t("label")}
            value={code}
            onChange={setCode}
            error={state.kind === "failed" ? problemText(state.problem) : null}
            touched={state.kind === "failed"}
            maxLength={40}
            autoComplete="off"
          />
          {state.kind === "needLogin" ? (
            <div className="flex flex-col gap-3 bg-surface-nav p-4">
              <span className="text-sm text-ink-soft">{t("needLogin")}</span>
              <div className="self-start">
                <MainButton text={t("logIn")} onClick={logIn} />
              </div>
            </div>
          ) : (
            <div className="self-start">
              <MainButton text={t("redeem")} onClick={() => undefined} disabled={!code.trim() || state.kind === "working"} loading={state.kind === "working"} submit />
            </div>
          )}
        </form>
      )}
    </div>
  </div>
);

export default CouponView;
