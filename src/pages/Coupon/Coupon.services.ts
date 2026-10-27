import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import UserContext from "../../UserContext";
import { redeemCoupon, setPendingCoupon, takePendingCoupon } from "../../services/coupons/CouponService";
import { handleAccountLock } from "../../components/verify/verifyEvents";
import { CouponProblem, CouponState } from "./Coupon.types";

const PROBLEMS: CouponProblem[] = ["unknown", "already", "off", "expired", "usedUp", "tooMany", "verify", "limited"];
const DISCORD_URL = (import.meta.env.VITE_DISCORD_INVITE as string) || "https://discord.gg/NMdYb2aBZK";

export const problemOf = (err: unknown): CouponProblem => {
  const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason;
  return PROBLEMS.includes(reason as CouponProblem) ? (reason as CouponProblem) : "retry";
};

// the redeem page: a code typed in, or one carried by a link from the bot's drop, which redeems by itself once the visitor is signed in
export const useCouponServices = () => {
  const { code: fromLink } = useParams();
  const { isLogged, toogleUserFlow, userData, toogleUserData } = useContext(UserContext);
  // a code waiting for its visitor to sign in: one from a link, one stashed before a sign-in that left the page, or one typed signed out
  const [waiting, setWaiting] = useState(() => fromLink || takePendingCoupon() || "");
  const [code, setCode] = useState(waiting);
  const [state, setState] = useState<CouponState>({ kind: "idle" });
  const sending = useRef("");
  const user = useRef(userData);
  user.current = userData;

  const redeem = useCallback(
    async (typed: string) => {
      setState({ kind: "working" });
      try {
        const res = await redeemCoupon(typed);
        setState({ kind: "done", amount: res.amount });
        if (user.current) toogleUserData({ ...user.current, walletBalance: res.walletBalance });
      } catch (err) {
        handleAccountLock(err, "coupon");
        setState({ kind: "failed", problem: problemOf(err) });
      }
    },
    [toogleUserData]
  );

  useEffect(() => {
    if (!waiting) return;
    if (!isLogged) {
      setPendingCoupon(waiting);
      setState({ kind: "needLogin" });
      toogleUserFlow(true);
      return;
    }
    // an effect can run twice for one change, and a second send would only hear "already redeemed"
    if (sending.current === waiting) return;
    sending.current = waiting;
    // the sign-in panel has done its job, and would otherwise sit on top of the answer
    toogleUserFlow(false);
    takePendingCoupon();
    setWaiting("");
    redeem(waiting).finally(() => {
      sending.current = "";
    });
  }, [waiting, isLogged, redeem, toogleUserFlow]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = code.trim();
    if (!typed || state.kind === "working") return;
    if (!isLogged) return setWaiting(typed);
    redeem(typed);
  };

  return {
    code,
    // a new code clears the last one's complaint
    setCode: (next: string) => {
      setCode(next);
      if (state.kind === "failed") setState({ kind: "idle" });
    },
    state,
    submit,
    logIn: () => toogleUserFlow(true),
    discordUrl: DISCORD_URL,
  };
};
