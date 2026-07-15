import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getMissions,
  claimMission,
  visitMission,
  MissionsData,
} from "../../services/missions/MissionService";

// remembers which claimable missions have already been announced, so the
// "mission complete" toast fires once per mission and not on every refetch
const SEEN_KEY = "kani.seenClaimable";

export const useMissionsServices = ({ isOwner }: { isOwner: boolean }) => {
  const [data, setData] = useState<MissionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getMissions();
      setData(res);
    } catch {
      setError(true);
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
    return () => {
      active = false;
    };
  }, [isOwner]);

  useEffect(() => {
    if (!data) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      seen = [];
    }
    const fresh = data.missions.filter((m) => m.claimable && !seen.includes(m.key));
    if (fresh.length) {
      fresh.forEach((m) => toast.info(`Mission complete: ${m.title}`));
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((m) => m.key)]));
    }
  }, [data]);

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

  return { data, loading, error, claimingKey, claim, visit, isOwner };
};
