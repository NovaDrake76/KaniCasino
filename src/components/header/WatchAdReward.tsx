import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { BiMoviePlay } from "react-icons/bi";
import Modal from "../Modal";
import MainButton from "../MainButton";
import UserContext from "../../UserContext";
import {
  getAdRewardStatus,
  startAdWatch,
  claimAdReward,
  showRewardedAd,
  AdRewardStatus,
} from "../../services/rewards/AdRewardServices";

// "watch an ad, earn KP": the server issues a one-time token, the ad plays, and the
// claim is refused unless enough time passed for a real view
const WatchAdReward = () => {
  const { userData, toogleUserData } = useContext(UserContext);
  const [status, setStatus] = useState<AdRewardStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [watchToken, setWatchToken] = useState<string | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressOn, setProgressOn] = useState(false);
  const [watchMs, setWatchMs] = useState(5000);

  useEffect(() => {
    if (!userData) return;
    getAdRewardStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [userData?.id]);

  if (!userData || !status || !status.enabled || status.remainingToday < 1) return null;

  const finishClaim = async (token: string) => {
    try {
      const res = await claimAdReward(token);
      toast.success(`+${res.claimed} K₽ for watching`, { theme: "dark" });
      toogleUserData({ ...userData, walletBalance: res.walletBalance });
      setStatus({ ...status, remainingToday: res.remainingToday });
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not pay the reward", { theme: "dark" });
    }
  };

  const startMock = (token: string, minWatchMs: number) => {
    setWatchToken(token);
    setWatchMs(minWatchMs);
    setCanClaim(false);
    setProgressOn(false);
    setOpen(true);
    // both waits start next frame so the bar animates and the claim unlocks together
    setTimeout(() => setProgressOn(true), 50);
    setTimeout(() => setCanClaim(true), minWatchMs + 100);
  };

  const begin = async () => {
    setBusy(true);
    try {
      const started = await startAdWatch();
      if (status.provider === "adsense") {
        showRewardedAd({
          onGranted: () => finishClaim(started.token),
          onDismissed: () => toast.info("Ad closed early, no reward", { theme: "dark" }),
          onUnavailable: () => toast.info("No ad available right now, try later", { theme: "dark" }),
        });
      } else {
        startMock(started.token, started.minWatchMs);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not start the ad", { theme: "dark" });
    } finally {
      setBusy(false);
    }
  };

  const claimMock = async () => {
    if (!watchToken) return;
    setBusy(true);
    await finishClaim(watchToken);
    setBusy(false);
    setOpen(false);
    setWatchToken(null);
  };

  return (
    <>
      <MainButton
        text={
          <span className="flex items-center gap-2">
            <BiMoviePlay className="text-xl" /> {`+${status.amount}`}
          </span>
        }
        onClick={begin}
        disabled={busy}
      />
      {open && (
        <Modal open={open} setOpen={setOpen} width="420px">
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
              {canClaim ? "All done, enjoy your coins." : "Watching the ad..."}
            </p>
            <MainButton
              text={`Claim +${status.amount} K₽`}
              onClick={claimMock}
              disabled={!canClaim || busy}
              loading={busy}
            />
          </div>
        </Modal>
      )}
    </>
  );
};

export default WatchAdReward;
