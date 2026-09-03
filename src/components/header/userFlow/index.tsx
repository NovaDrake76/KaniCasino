import { useContext, useRef, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Login from "./Login";
import SignUp from "./SignUp";
import "./UserFlow.css";
import UserContext from "../../../UserContext";
import useOutsideClick from "../../../hooks/useOutsideClick";
import Modal from "../../Modal";
import { getPendingReferralCode } from "../../../services/referrals/ReferralServices";
import i18n from "../../../i18n";

// the provider fetches google's sign-in script the moment it mounts, so it lives here
// with the only two components that need it (Login and SignUp) rather than around the
// whole app. the header does not mount this panel until it is first opened, which is
// what keeps that script off every page view.
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const UserFlow: React.FC = () => {
  // a visitor arriving through a referral link is here to create the account
  const [isLogin, setIsLogin] = useState<boolean>(() => !getPendingReferralCode());
  const { toogleUserFlow } = useContext(UserContext);
  const loginRef = useRef(null);

  useOutsideClick(loginRef, () => {
    toogleUserFlow(false);
  }
  );

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div ref={loginRef} >
        <Modal open={true} setOpen={toogleUserFlow} width={"400px"}>
          <div className="flex items-center justify-center p-6">
            <div className="flex w-full flex-col justify-center">
              {isLogin ? <Login /> : <SignUp />}
              <button
                type="button"
                className="mt-3 border-none bg-transparent p-0 text-center text-xs text-secondary-light hover:text-white hover:border-none"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? i18n.t("auth.createAccount") : i18n.t("auth.orLogin")}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </GoogleOAuthProvider>
  );
};

export default UserFlow;
