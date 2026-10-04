import { useContext, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import UserContext from "../../UserContext";
import { me } from "../../services/auth/auth";
import { getAccessToken } from "../../services/auth/authUtils";
import { confirmEmail, problemOf, VerifyProblem } from "../../services/account/AccountService";
import i18n from "../../i18n";

type State = "working" | "done" | VerifyProblem | "failed";

// where the link in the verification email lands. it works logged out too, because the link carries its own proof.
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const { toogleUserData } = useContext(UserContext);
  const [state, setState] = useState<State>("working");
  const [email, setEmail] = useState("");
  // a token is single use, so a second run of the effect must not spend it again
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) return setState("expired");
    confirmEmail(token)
      .then((res) => {
        setEmail(res.email);
        setState("done");
        // the app may still be loading its session, so the stored token is the one to ask
        if (getAccessToken()) me().then(toogleUserData).catch(() => undefined);
      })
      .catch((err) => setState(problemOf(err).reason || "failed"));
  }, [params, toogleUserData]);

  return (
    <div className="w-full flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full flex flex-col items-center gap-3 text-center bg-surface border border-line rounded-lg p-8">
        {state === "working" && <span className="text-ink-soft">{i18n.t("verify.page.working")}</span>}
        {state === "done" && (
          <>
            <span className="text-xl font-bold">{i18n.t("verify.page.done")}</span>
            <span className="text-sm text-ink-soft">{i18n.t("verify.page.doneBody", { email })}</span>
          </>
        )}
        {state !== "working" && state !== "done" && (
          <>
            <span className="text-xl font-bold">{i18n.t("verify.page.failed")}</span>
            <span className="text-sm text-ink-soft">{i18n.t(`verify.errors.${state}`)}</span>
          </>
        )}
        {state !== "working" && (
          <Link to="/" className="mt-2 text-sm font-semibold text-secondary-light hover:text-white">
            {i18n.t("verify.page.back")}
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
