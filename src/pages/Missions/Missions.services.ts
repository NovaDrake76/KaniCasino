import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getMissions,
  claimMission,
  visitMission,
  MissionsData,
} from "../../services/missions/MissionService";

// remembers which claimable missions have already been announced (per user, so a
// shared browser doesn't suppress another account's toasts), so the "mission
// complete" toast fires once per mission and not on every refetch
const seenKeyFor = (userId: string) => `kani.seenClaimable.${userId}`;

export const useMissionsServices = ({ isOwner, userId }: { isOwner: boolean; userId: string }) => {
  const [data, setData] = useState<MissionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

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
    return () => {
      active = false;
    };
  }, [isOwner]);

  useEffect(() => {
    if (!data || !userId) return;
    const seenKey = seenKeyFor(userId);
    const claimableKeys = data.missions.filter((m) => m.claimable).map((m) => m.key);
    const raw = localStorage.getItem(seenKey);
    // first ever view for this user: seed silently so pre-existing completions do
    // not stack a burst of toasts. only genuinely-new completions toast afterwards.
    if (raw === null) {
      localStorage.setItem(seenKey, JSON.stringify(claimableKeys));
      return;
    }
    let seen: string[] = [];
    try {
      seen = JSON.parse(raw);
    } catch {
      seen = [];
    }
    const fresh = claimableKeys.filter((k) => !seen.includes(k));
    if (fresh.length) {
      fresh.forEach((k) => {
        const m = data.missions.find((x) => x.key === k);
        if (m) toast.info(`Mission complete: ${m.title}`);
      });
      localStorage.setItem(seenKey, JSON.stringify([...new Set([...seen, ...claimableKeys])]));
    }
  }, [data, userId]);

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
