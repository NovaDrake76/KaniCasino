import { useContext, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import { rarityColor } from "../../../utils/rarity";
import { getCase } from "../../../services/cases/CaseServices";
import {
  getBattle,
  joinBattle,
  startBattle,
  addBot,
  kickPlayer,
  leaveBattle,
  getSocket,
  Battle,
  BattlePlayer,
  MODE_SLOTS,
} from "../../../services/battles/BattleService";
import {
  BattleColumn,
  CaseMeta,
  CaseQueueItem,
  MyResult,
  ReelView,
  TieView,
  WinnerBanner,
} from "./BattleRoom.types";

const REEL_MS = 4200; // must stay under the backend's REVEAL_MS (4500)
const WINDOW_H = 420; // reel window height — must match BattleReel (ITEM_H * WINDOW_CELLS)
const TIE_MS = 4200; // tie-breaker roulette spin

const EMPTY_COLUMNS: BattleColumn[] = [];
const EMPTY_QUEUE: CaseQueueItem[] = [];

export const useBattleRoomServices = () => {
  const { id = "" } = useParams();
  const { userData, isLogged, toogleUserFlow } = useContext(UserContext);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseMap, setCaseMap] = useState<Record<string, CaseMeta>>({});
  const [spinRound, setSpinRound] = useState(-1);
  const [settledRound, setSettledRound] = useState(-1);
  const [tieSpun, setTieSpun] = useState(false);
  const [starting, setStarting] = useState(false);
  const settleTimer = useRef<number | null>(null);
  const activeCaseRef = useRef<HTMLDivElement | null>(null);
  const socket = getSocket();
  const navigate = useNavigate();

  // the top total may be tied; the tie-breaker roulette runs before the result
  const revealComplete = battle?.status === "finished" && spinRound < 0;
  const isTie = (battle?.tiedTeams?.length ?? 0) > 1;
  const resultShown = !!revealComplete && (!isTie || tieSpun);

  useEffect(() => {
    let active = true;

    getBattle(id).then((b) => {
      if (!active) return;
      setBattle(b);
      setLoading(false);
      if (!b) return;
      if (b.status === "finished") setSettledRound(b.cases.length - 1);
      else if (b.status === "in_progress") setSettledRound(b.currentRound - 1);
      else setSettledRound(-1);
      // a battle already finished on load skips the tie-breaker animation
      setTieSpun(b.status === "finished");

      const unique = Array.from(new Set(b.cases));
      Promise.all(
        unique.map((cid) =>
          getCase(cid)
            .then((c) => [cid, c] as const)
            .catch(() => [cid, null] as const)
        )
      ).then((entries) => {
        if (!active) return;
        const map: Record<string, CaseMeta> = {};
        for (const [cid, c] of entries) {
          if (c) map[cid] = { title: c.title, image: c.image, price: c.price, items: c.items || [] };
        }
        setCaseMap(map);
        // warm the browser cache so reels don't spin with unloaded images
        for (const meta of Object.values(map)) {
          for (const it of meta.items) {
            if (it.image) new Image().src = it.image;
          }
        }
      });
    });

    const onState = (b: Battle) => {
      if (b.id !== id) return;
      setBattle(b);
      if (b.status === "waiting" || (b.status === "in_progress" && b.currentRound === 0)) {
        setSettledRound(-1);
        setSpinRound(-1);
      }
    };
    const onRound = (data: { battleId: string; round: number; players: BattlePlayer[] }) => {
      if (data.battleId !== id) return;
      setBattle((prev) =>
        prev ? { ...prev, players: data.players, currentRound: data.round + 1, status: "in_progress" } : prev
      );
      setSpinRound(data.round);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        setSettledRound(data.round);
        setSpinRound(-1);
      }, REEL_MS);
    };
    const onFinished = (b: Battle) => {
      if (b.id !== id) return;
      // keep the last reel spinning; the settle timer reveals the winner
      setBattle(b);
    };
    // a reconnect drops us from the battle room; re-fetch to rejoin and catch up
    const onConnect = () => {
      getBattle(id).then((b) => {
        if (!active || !b) return;
        setBattle(b);
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        setSpinRound(-1);
        if (b.status === "finished") setSettledRound(b.cases.length - 1);
        else if (b.status === "in_progress") setSettledRound(b.currentRound - 1);
        else setSettledRound(-1);
        setTieSpun(b.status === "finished");
      });
    };

    socket.on("battle:state", onState);
    socket.on("battle:round", onRound);
    socket.on("battle:finished", onFinished);
    socket.on("connect", onConnect);
    return () => {
      active = false;
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      socket.off("battle:state", onState);
      socket.off("battle:round", onRound);
      socket.off("battle:finished", onFinished);
      socket.off("connect", onConnect);
    };
  }, [id]);

  // keep the case currently being opened scrolled into view in the queue strip
  useEffect(() => {
    activeCaseRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [spinRound, settledRound]);

  // once every reel has settled on a tie, spin the tie-breaker, then reveal
  useEffect(() => {
    if (!revealComplete || !isTie || tieSpun) return;
    const t = window.setTimeout(() => setTieSpun(true), TIE_MS);
    return () => window.clearTimeout(t);
  }, [revealComplete, isTie, tieSpun]);

  const doJoin = async () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }
    const res = await joinBattle(id);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doStart = async () => {
    if (starting) return;
    setStarting(true);
    const res = await startBattle(id);
    // on success the battle leaves "waiting" and the start button unmounts;
    // only re-enable on error so the host can retry
    if (res.error) {
      toast.error(res.error, { theme: "dark" });
      setStarting(false);
    }
  };
  const doAddBot = async () => {
    const res = await addBot(id);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doKick = async (slot: number) => {
    const res = await kickPlayer(id, slot);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doLeave = () => {
    leaveBattle(id);
    navigate("/battles");
  };
  const onCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Invite link copied", { theme: "dark" });
  };
  const onBack = () => navigate("/battles");

  let columns = EMPTY_COLUMNS;
  let caseQueue = EMPTY_QUEUE;
  let banner: WinnerBanner | null = null;
  let tie: TieView | null = null;
  let myResult: MyResult = null;
  let displayRound = 0;
  let showCopyLink = false;
  let showStart = false;
  let startDisabled = false;
  let startLabel = "";
  let showLeave = false;
  let leaveLabel = "";
  let showWaitingForHost = false;
  let waitingForHostLabel = "";
  let showCancelled = false;
  let showBack = false;

  if (battle) {
    const slots = MODE_SLOTS[battle.mode] || battle.players.length;
    const myId = userData?.id;
    const isHost = !!myId && battle.createdBy === myId;
    const inBattle = !!battle.players.find((p) => p.userId && p.userId === myId);
    const full = battle.players.length >= slots;
    const playerAt = (slot: number) => battle.players.find((p) => p.slot === slot) ?? null;

    const pot = battle.players.reduce((s, p) => s + (p.total || 0), 0);
    const totalItems = battle.players.reduce((s, p) => s + p.items.length, 0);
    const humanWinners = battle.players.filter(
      (p) => p.userId && battle.winnerUserIds.includes(p.userId)
    );
    // prefer the authoritative team from the backend so a bot win still resolves
    const winningTeam = battle.winningTeam ?? (humanWinners.length ? humanWinners[0].team : null);
    const winningPlayers =
      winningTeam !== null ? battle.players.filter((p) => p.team === winningTeam) : [];
    const teamSize = winningPlayers.length;
    const isWinner = (p: BattlePlayer) => winningTeam !== null && p.team === winningTeam;
    const perWinnerValue = teamSize ? pot / teamSize : 0;
    const winnerNames = winningPlayers.map((w) => w.username).join(" & ");

    const activeIdx = spinRound >= 0 ? spinRound : settledRound;
    // only count landed items so the total doesn't jump before its reel settles
    const settledItems = (p: BattlePlayer) => p.items.slice(0, settledRound + 1);
    const shownTotal = (p: BattlePlayer) =>
      settledItems(p).reduce((s, it) => s + (it.baseValue || 0), 0);

    const reelFor = (p: BattlePlayer): ReelView => {
      if (spinRound >= 0 && p.items[spinRound]) {
        return {
          kind: "spin",
          spinKey: `${p.slot}-${spinRound}`,
          pool: caseMap[battle.cases[spinRound]]?.items || [],
          winner: p.items[spinRound],
        };
      }
      if (settledRound >= 0 && p.items[settledRound]) {
        const it = p.items[settledRound];
        return { kind: "settled", item: it, color: rarityColor(it.rarity) };
      }
      const firstCase = caseMap[battle.cases[0]];
      return { kind: "idle", image: firstCase?.image, title: firstCase?.title };
    };

    displayRound =
      battle.status === "waiting" ? 0 : Math.min(battle.currentRound, battle.cases.length);

    caseQueue = battle.cases.map((cid, i) => {
      const meta = caseMap[cid];
      return {
        key: i,
        image: meta?.image,
        title: meta?.title,
        revealed: settledRound >= i || i === activeIdx,
        active: i === activeIdx,
      };
    });

    columns = Array.from({ length: slots }).map((_, slot) => {
      const p = playerAt(slot);
      return {
        key: slot,
        player: p,
        isWinner: !!p && resultShown && isWinner(p),
        teamTag: p && battle.mode === "2v2" ? `T${p.team + 1}` : null,
        showTotal: !!p && battle.status !== "waiting",
        total: p ? shownTotal(p) : 0,
        reel: p ? reelFor(p) : { kind: "idle" },
        wonItems: p
          ? settledItems(p).map((it) => ({ item: it, color: rarityColor(it.rarity) }))
          : [],
        canJoin: !p && battle.status === "waiting" && !inBattle,
        canAddBot: !p && battle.status === "waiting" && isHost,
        canKick: !!p && battle.status === "waiting" && isHost && slot !== 0,
        onJoin: doJoin,
        onAddBot: doAddBot,
        onKick: () => doKick(slot),
      };
    });

    banner =
      resultShown && winningTeam !== null
        ? {
            winnerNames,
            teamSize,
            totalItems,
            value: teamSize > 1 ? perWinnerValue : pot,
            perItemEach: teamSize > 1,
            bakaHint: battle.bakaMode ? "lowest unboxed value wins" : "highest unboxed value wins",
          }
        : null;

    // tie-breaker roulette: spin the tied players, land on the winning side
    if (revealComplete && isTie && !tieSpun && winningPlayers.length) {
      const tiedPlayers = battle.players.filter((p) => battle.tiedTeams.includes(p.team));
      tie = { players: tiedPlayers, winner: winningPlayers[0] };
    }

    const mine = userData?.id ? battle.players.find((p) => p.userId === userData.id) : null;
    if (resultShown && mine) myResult = isWinner(mine) ? "won" : "lost";

    showCopyLink = battle.status === "waiting";
    showStart = battle.status === "waiting" && isHost;
    startDisabled = !full || starting;
    startLabel = full
      ? "Start battle"
      : `Waiting for players (${battle.players.length}/${slots})`;
    showLeave = battle.status === "waiting" && inBattle;
    leaveLabel = isHost ? "Cancel battle" : "Leave";
    // non-host players can't start, so tell them what they are waiting on
    showWaitingForHost = battle.status === "waiting" && inBattle && !isHost;
    waitingForHostLabel = full
      ? "Waiting for the host to start the battle"
      : `Waiting for players (${battle.players.length}/${slots})`;
    showCancelled = battle.status === "cancelled";
    showBack = resultShown || battle.status === "cancelled";
  }

  return {
    loading,
    notFound: !loading && !battle,
    mode: battle?.mode ?? "",
    bakaMode: !!battle?.bakaMode,
    casesCount: battle?.cases.length ?? 0,
    entryCost: battle?.entryCost ?? 0,
    displayRound,
    windowHeight: WINDOW_H,
    reelDurationMs: REEL_MS,
    activeCaseRef,
    caseQueue,
    columns,
    banner,
    tie,
    tieDurationMs: TIE_MS,
    myResult,
    showCopyLink,
    onCopyLink,
    onBack,
    showStart,
    startDisabled,
    startLoading: starting,
    startLabel,
    showLeave,
    leaveLabel,
    showWaitingForHost,
    waitingForHostLabel,
    showCancelled,
    showBack,
    onStart: doStart,
    onLeave: doLeave,
  };
};
