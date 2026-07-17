import MainButton from "../MainButton";
import { claimBonus } from "../../services/users/UserServices";
import { toast } from "react-toastify";
import { useContext, useEffect, useState } from "react";
import { BiMoviePlay } from "react-icons/bi";
import Modal from "../Modal";
import UserContext from "../../UserContext";
import { User } from '../../components/Types';
import {
  getAdRewardStatus,
  startAdWatch,
  claimAdReward,
  showRewardedAd,
  AdRewardStatus,
} from "../../services/rewards/AdRewardServices";

interface IBonus {
  bonusDate: string;
  userData: User;
}

// one button, three states: while the bonus is on cooldown it shows the countdown; when it
// is due it becomes Claim Bonus; and if the player has a rewarded ad left, the cooldown
// state instead offers the ad (+KP) alongside the countdown. the ad is always optional: when
// the countdown reaches zero the bonus takes over and any un-watched ad offer just goes away.
const ClaimBonus: React.FC<IBonus> = ({ bonusDate, userData }) => {
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [loadingBonus, setLoadingBonus] = useState(false);
  const { toogleUserFlow, toogleUserData } = useContext(UserContext);

  // the optional watch-an-ad offer that rides alongside the cooldown
  const [adStatus, setAdStatus] = useState<AdRewardStatus | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [watchToken, setWatchToken] = useState<string | null>(null);
  const [canClaimAd, setCanClaimAd] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [progressOn, setProgressOn] = useState(false);
  const [watchMs, setWatchMs] = useState(5000);

  useEffect(() => {
    if (!bonusDate) return;
    const tick = () => {
      const diff = new Date(bonusDate).getTime() - Date.now();
      if (diff <= 0) {
        setBonusAvailable(true);
        setTimeLeft("");
        return true;
      }
      setBonusAvailable(false);
      setTimeLeft(new Date(Math.floor(diff / 1000) * 1000).toISOString().substring(14, 19));
      return false;
    };
    if (tick()) return; // already due, no interval needed
    const interval = setInterval(() => {
      if (tick()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [bonusDate]);

  useEffect(() => {
    if (!userData) return;
    getAdRewardStatus().then(setAdStatus).catch(() => setAdStatus(null));
  }, [userData?.id]);

  const claimUserBonus = async () => {
    setLoadingBonus(true);
    try {
      const res = await claimBonus();
      toogleUserFlow(false);
      setBonusAvailable(false);
      toast.success(res.message, { theme: "dark" });
      toogleUserData({ ...userData, nextBonus: res.nextBonus, walletBalance: userData.walletBalance + res.value });
      // the ad offer now fills the cooldown window; its status is already loaded and a
      // bonus claim does not change how many ads are left, so nothing to refetch here
    } catch (error: any) {
      toast.error(`${error.response?.data?.message || "Could not claim the bonus"}!`, { theme: "dark" });
    } finally {
      setLoadingBonus(false);
    }
  };

  const finishAd = async (token: string) => {
    try {
      const res = await claimAdReward(token);
      toast.success(`+${res.claimed} K₽ for watching`, { theme: "dark" });
      toogleUserData({ ...userData, walletBalance: res.walletBalance });
      setAdStatus((s) => (s ? { ...s, remainingToday: res.remainingToday } : s));
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not pay the reward", { theme: "dark" });
    }
  };

  const startMock = (token: string, minWatchMs: number) => {
    setWatchToken(token);
    setWatchMs(minWatchMs);
    setCanClaimAd(false);
    setProgressOn(false);
    setAdOpen(true);
    // both waits start next frame so the bar animates and the claim unlocks together
    setTimeout(() => setProgressOn(true), 50);
    setTimeout(() => setCanClaimAd(true), minWatchMs + 100);
  };

  const beginAd = async () => {
    if (!adStatus) return;
    setAdBusy(true);
    try {
      const started = await startAdWatch();
      if (adStatus.provider === "adsense") {
        showRewardedAd({
          onGranted: () => finishAd(started.token),
          onDismissed: () => toast.info("Ad closed early, no reward", { theme: "dark" }),
          onUnavailable: () => toast.info("No ad available right now, try later", { theme: "dark" }),
        });
      } else {
        startMock(started.token, started.minWatchMs);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not start the ad", { theme: "dark" });
    } finally {
      setAdBusy(false);
    }
  };

  const claimMockAd = async () => {
    if (!watchToken) return;
    setAdBusy(true);
    await finishAd(watchToken);
    setAdBusy(false);
    setAdOpen(false);
    setWatchToken(null);
  };

  // the offer only stands in while the bonus is cooling down and an ad is left today
  const adOffered = !bonusAvailable && !!adStatus && adStatus.enabled && adStatus.remainingToday > 0;

  return (
    <>
      {bonusAvailable ? (
        <MainButton text="Claim Bonus" onClick={claimUserBonus} pulse disabled={loadingBonus} />
      ) : adOffered ? (
        <MainButton
          onClick={beginAd}
          disabled={adBusy}
          text={
            <span className="flex items-center gap-2 whitespace-nowrap">
              <BiMoviePlay className="text-lg" />
              <span className="font-bold">+{adStatus?.amount}</span>
              <span className="text-xs font-normal opacity-70">next bonus {timeLeft}</span>
            </span>
          }
        />
      ) : (
        <MainButton
          onClick={() => undefined}
          disabled
          text={<span className="text-sm">Next bonus in {timeLeft}</span>}
        />
      )}

      {adOpen && (
        <Modal open={adOpen} setOpen={setAdOpen} width="420px">
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="w-full aspect-video bg-surface-nav rounded-md flex items-center justify-center relative overflow-hidden">
              <BiMoviePlay className="text-6xl text-ink-faint" />
              <span className="absolute top-2 left-2 text-xs text-ink-muted uppercase">Ad</span>
              <div
                className="absolute bottom-0 left-0 h-1 bg-accent-gold"
                style={{
                  width: progressOn ? "100%" : "0%",
                  transition: progressOn ? `width ${watchMs}ms linear` : "none",
                }}
              />
            </div>
            <p className="text-ink-soft text-sm text-center">
              {canClaimAd ? "All done, enjoy your coins." : "Watching the ad..."}
            </p>
            <MainButton
              text={`Claim +${adStatus?.amount} K₽`}
              onClick={claimMockAd}
              disabled={!canClaimAd || adBusy}
              loading={adBusy}
            />
          </div>
        </Modal>
      )}
    </>
  );
};

export default ClaimBonus;
