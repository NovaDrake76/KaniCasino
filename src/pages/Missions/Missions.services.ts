import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getMissions,
  getPendingMissions,
  claimMission,
  visitMission,
  MissionsData,
} from "../../services/missions/MissionService";
import { getCases } from "../../services/cases/CaseServices";
import { toastMissionComplete } from "./components/missionCompleteToast";

export const useMissionsServices = ({ isOwner }: { isOwner: boolean }) => {
  const [data, setData] = useState<MissionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [caseImage, setCaseImage] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await getMissions();
      setData(res);
      setError(false);
    } catch {
      // a refetch failure must not blank an already-loaded panel; the triggering
      // action reports its own success/failure via a toast
    }
  }, []);

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    getMissions()
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // a full pending check on tab open catches completions the frequent balance-change
    // checks skip (collections, and social/state missions); the server announces each once
    getPendingMissions(false)
      .then((pending) => {
        if (active) pending.forEach(toastMissionComplete);
      })
      .catch(() => {
        // best-effort: a failed pending check just means no toast this time
      });
    // a real case image for the case/collection missions; icon fallback if it fails
    getCases()
      .then((cases) => {
        const img = Array.isArray(cases) ? cases.find((c) => c && c.image)?.image : undefined;
        if (active && img) setCaseImage(img);
      })
      .catch(() => {
        // fall back to the chest icon
      });
    return () => {
      active = false;
    };
  }, [isOwner]);

  const claim = async (key: string) => {
    setClaimingKey(key);
    try {
      const res = await claimMission(key);
      if (res.claimed) toast.success(`Reward claimed: +${res.reward} K₽`);
      else if (res.alreadyClaimed) toast.info("Already claimed");
      await load();
    } catch {
      toast.error("Could not claim reward");
    } finally {
      setClaimingKey(null);
    }
  };

  const visit = async (key: string, url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await visitMission(key);
    } catch {
      // honor-system: marking the visit is best-effort
    }
    await load();
  };

  return { data, loading, error, claimingKey, claim, visit, isOwner, caseImage };
};
