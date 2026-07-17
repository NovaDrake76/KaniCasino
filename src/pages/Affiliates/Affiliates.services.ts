import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getReferralDashboard,
  createReferralCode,
  claimReferralEarnings,
  ReferralDashboard,
} from "../../services/referrals/ReferralServices";
import UserContext from "../../UserContext";

export const useAffiliatesServices = () => {
  const { userData } = useContext(UserContext);
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);

  const load = async () => {
    try {
      setData(await getReferralDashboard());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData) {
      load();
    } else {
      setLoading(false);
    }
  }, [userData?.id]);

  const saveCode = async (code: string) => {
    setSaving(true);
    try {
      await createReferralCode(code);
      toast.success("Your referral link is live");
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not save the code");
    } finally {
      setSaving(false);
    }
  };

  const link = data?.referralCode ? `${window.location.origin}/r/${data.referralCode}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.info("Link copied");
  };

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await claimReferralEarnings();
      toast.success(`Claimed +${res.claimed} K₽`);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not claim");
    } finally {
      setClaiming(false);
    }
  };

  return { userData, data, loading, error, saving, claiming, saveCode, claim, copyLink, link };
};
