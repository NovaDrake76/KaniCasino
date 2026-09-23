import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { claimRoadmapMission, getRoadmap, Roadmap, ROADMAP_CHANGED_EVENT } from "../../../services/daisu/RoadmapService";
import type { Stage } from "../Daisu.types";
import { track } from "../../../services/usage/usage";
import i18n from "../../../i18n";

interface Args {
  enabled: boolean;
  userId?: string;
  stage: Stage;
  onClaimed: (reward: number, walletBalance?: number) => void;
}

// her missions: read when she mounts, each time she opens, and whenever one of them completes
export const useRoadmap = ({ enabled, userId, stage, onClaimed }: Args) => {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [chapterDone, setChapterDone] = useState<{ chapter: number; bonus: number } | null>(null);
  const [helpKey, setHelpKey] = useState<string | null>(null);
  // a read that left before a claim must not land after it
  const seq = useRef(0);
  const live = enabled && !!userId;

  const load = useCallback(() => {
    const s = ++seq.current;
    getRoadmap()
      .then((r) => {
        if (s === seq.current) setRoadmap(r);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!live) {
      seq.current += 1;
      setRoadmap(null);
      return;
    }
    load();
  }, [live, userId, stage, load]);

  useEffect(() => {
    if (!live) return;
    window.addEventListener(ROADMAP_CHANGED_EVENT, load);
    return () => window.removeEventListener(ROADMAP_CHANGED_EVENT, load);
  }, [live, load]);

  const claimMission = async (key: string) => {
    if (claiming) return;
    setClaiming(key);
    try {
      const res = await claimRoadmapMission(key);
      seq.current += 1;
      setRoadmap(res.roadmap);
      if (res.claimed) {
        onClaimed(res.reward ?? 0, res.walletBalance);
        if (res.chapterDone) setChapterDone(res.chapterDone);
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      track("mission_claim_failed", { mission: key, status: e?.response?.status ?? 0 });
      toast.error(e?.response?.data?.message || i18n.t("missions.couldNotClaimReward"), { theme: "dark" });
      load();
    } finally {
      setClaiming(null);
    }
  };

  return {
    roadmap,
    claimingMission: claiming,
    claimMission,
    helpKey,
    toggleHelp: (key: string) => {
      if (helpKey !== key) track("mission_help", { mission: key });
      setHelpKey((open) => (open === key ? null : key));
    },
    showHelp: setHelpKey,
    chapterDone,
    closeChapterDone: () => setChapterDone(null),
  };
};
