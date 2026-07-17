import { useContext, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UserContext from "../../UserContext";
import { setPendingReferralCode } from "../../services/referrals/ReferralServices";
import { getAccessToken } from "../../services/auth/authUtils";

// landing point of a shared /r/<code> link: remember the code, send the visitor
// home and open the signup flow with it prefilled
const ReferralRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toogleUserFlow } = useContext(UserContext);

  useEffect(() => {
    if (code && /^[a-zA-Z0-9]{3,16}$/.test(code) && !getAccessToken()) {
      setPendingReferralCode(code);
      toogleUserFlow(true);
    }
    navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default ReferralRedirect;
