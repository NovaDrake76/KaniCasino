import { useContext, useRef, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Login from "./Login";
import SignUp from "./SignUp";
import "./UserFlow.css";
import UserContext from "../../../UserContext";
import useOutsideClick from "../../../hooks/useOutsideClick";
import Modal from "../../Modal";
import { getPendingReferralCode } from "../../../services/referrals/ReferralServices";

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
          <div className="flex items-center justify-center p-8" >
            <div
              className={`flex flex-col justify-center transition-all ${isLogin ? "h-[340px]" : "h-[460px]"
                }`}
            >
              {isLogin ? <Login /> : <SignUp />}
              <div
                className="flex text-black justify-end cursor-pointer mt-1"
                onClick={() => {
                  setIsLogin(!isLogin);
                }}
              >
                {isLogin ? (
                  <div className="text-blue-500 underline">Or create an account</div>
                ) : (
                  <div className="text-blue-500 underline">Or Login</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </GoogleOAuthProvider>
  );
};

export default UserFlow;
