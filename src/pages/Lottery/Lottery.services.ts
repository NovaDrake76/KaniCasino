import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import SocketConnection from "../../services/socket";
import { noteServerTime, serverNow } from "../../services/serverClock";
import { play } from "../../services/sound/sound";
import { useVerification } from "../../components/verify/useVerification";
import { handleAccountLock, openVerify } from "../../components/verify/verifyEvents";
import {
  buyLotteryTickets,
  getDrawTickets,
  getLottery,
  getLotteryDraws,
  DrawPage,
  DrawnEvent,
  LotteryMe,
  LotteryState,
  LotteryTicket,
  OpenDraw,
  PotUpdate,
  SettledDraw,
} from "../../services/lottery/LotteryService";
import i18n from "../../i18n";
import {
  CAP,
  NUMBERS,
  PICK,
  PRIZES,
  QUICK_MANY,
  addQuickPicks,
  addToSlip,
  formatCountdown,
  kpText,
  quickPick,
  removeFromSlip,
  repeatTickets,
  slipRoom,
  slipTotal,
  sortPick,
  togglePick,
} from "./lotteryRules";
import { canVerify, checkDraw } from "./lotteryFair";
import { markSeen, seenDraw } from "./lotterySeen";
import {
  BallView,
  CheckView,
  GridCell,
  HistoryRow,
  LastDrawView,
  MainAction,
  MyTicketRow,
  Pager,
  PrizeRow,
  QuickMany,
  SlipRow,
  StageView,
} from "./Lottery.types";
import type { DrumSpeed } from "./Drum/Drum.types";

// a ball every second and a half, then the page moves on to the next draw
export const BALL_MS = 1500;
// the backend holds the winners' balances back for its REVEAL_MS (6000), as long as the balls take to come out here
export const REVEAL_TOTAL_MS = BALL_MS * (PICK + 1);
// the countdown ran out and the socket said nothing: ask again this often until the draw has moved on
const LATE_POLL_MS = 20000;
const LATE_AFTER_MS = 15000;
// once the reveal is over, the drawn balls and the result stay up this long before the drum refills for the next draw
export const RESULT_MS = 10000;
// a replay is the whole live sequence, hold included; one that would still be up when the real draw starts is not begun
export const REPLAY_MS = REVEAL_TOTAL_MS + RESULT_MS;

const TIERS = [
  { k: 3, label: "lottery.tier3" },
  { k: 2, label: "lottery.tier2" },
  { k: 1, label: "lottery.tier1" },
];

type Check = { running: boolean; ok: boolean | null; text: string | null };
// "auto" plays a missed draw back to a player who had tickets in it, "watch" is the button; neither moves any money
type ReplayKind = "auto" | "watch";
type Outcome = { text: string; won: boolean };
// a draw on the stage: balls come out until done, then it holds the result. a replay is a settled draw played back
type Reveal = { event: DrawnEvent; shown: number; carried: number; done: boolean; replay: ReplayKind | null };

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const errorOf = (error: unknown) => (error as { response?: { status?: number; data?: { message?: string } } })?.response;

const dateOf = (iso: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }).format(new Date(iso));

const names = (list: string[]) =>
  typeof Intl.ListFormat === "function" ? new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(list) : list.join(", ");

const ballsOf = (numbers: number[], tone: BallView["tone"] = "drawn"): BallView[] => numbers.map((n) => ({ n, tone }));

const ticketRows = (tickets: LotteryTicket[], drawn: number[]): MyTicketRow[] =>
  tickets.map((ticket, i) => ({
    key: `${i}-${ticket.numbers.join("-")}`,
    balls: ticket.numbers.map((n) => ({ n, tone: drawn.includes(n) ? "hit" : "miss" })),
    prize: ticket.prize ? kpText(ticket.prize) : i18n.t("lottery.noPrize"),
    won: !!ticket.prize,
  }));

const jackpotLine = (draw: Pick<SettledDraw, "jackpotWinners" | "jackpotEach">) => {
  const winners = draw.jackpotWinners;
  if (!winners.length) return i18n.t("lottery.rolledOver");
  if (winners.length === 1) return i18n.t("lottery.wonByOne", { name: winners[0].username, amount: kpText(draw.jackpotEach * winners[0].tickets) });
  return i18n.t("lottery.wonBy", { names: names(winners.map((w) => w.username)), amount: kpText(draw.jackpotEach) });
};

// what the player's own tickets in a draw came to, when they had any
const outcomeOf = (mine: LotteryMe["last"]): Outcome | null => {
  if (!mine || !mine.tickets.length) return null;
  return mine.won > 0 ? { text: i18n.t("lottery.resultWon", { amount: kpText(mine.won) }), won: true } : { text: i18n.t("lottery.resultNone"), won: false };
};

const eventOf = (d: SettledDraw): DrawnEvent => ({
  number: d.number,
  numbers: d.numbers,
  jackpot: d.jackpot,
  jackpotEach: d.jackpotEach,
  winners: d.winners,
  jackpotWinners: d.jackpotWinners,
  next: null,
});

export const useLotteryServices = () => {
  const { userData, toogleUserData, toogleUserFlow } = useContext(UserContext);
  const verification = useVerification();
  const userId: string | null = userData ? String(userData.id ?? userData._id ?? "") : null;

  const [state, setState] = useState<LotteryState | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => serverNow());
  const [pick, setPick] = useState<number[]>([]);
  const [slip, setSlip] = useState<number[][]>([]);
  const [buying, setBuying] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<DrawPage | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTick, setHistoryTick] = useState(0);
  const [openDraw, setOpenDraw] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<number, Check>>({});
  const [mineIn, setMineIn] = useState<Record<number, LotteryTicket[]>>({});

  const lastLoad = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const openDrawRef = useRef<OpenDraw | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const next = await getLottery();
      noteServerTime(next.serverTime);
      setState(next);
      setFailed(false);
      return next;
    } catch {
      setFailed(true);
      return null;
    }
  }, []);

  // signing in or out changes what the page shows about the player, so it asks again
  useEffect(() => {
    load();
    setMineIn({});
  }, [load, userId]);

  useEffect(() => {
    getLotteryDraws(historyPage)
      .then(setHistory)
      .catch(() => undefined);
  }, [historyPage, historyTick]);

  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // the result stays up beside the drawn balls for a while, then the stage goes back to the open draw
  const holdResult = useCallback((number: number, outcome: Outcome | null) => {
    if (outcome) {
      setResult(outcome);
      if (outcome.won) play("game.win");
    }
    timers.current.push(
      setTimeout(() => {
        setReveal((r) => (r && r.event.number === number ? null : r));
        setResult(null);
      }, RESULT_MS)
    );
  }, []);

  const finishReveal = useCallback(
    async (number: number) => {
      const next = await load();
      setReveal((r) => (r && r.event.number === number ? { ...r, shown: r.event.numbers.length, done: true } : r));
      setHistoryPage(1);
      setHistoryTick((n) => n + 1);
      holdResult(number, outcomeOf(next && next.me && next.me.last && next.me.last.number === number ? next.me.last : null));
    },
    [load, holdResult]
  );

  // the balls come out one at a time, or all at once for a player who asked the system for less motion
  const runBalls = useCallback((event: DrawnEvent, carried: number, replay: ReplayKind | null, finish: () => void) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResult(null);
    if (reducedMotion()) {
      setReveal({ event, shown: event.numbers.length, carried, done: false, replay });
      timers.current.push(setTimeout(finish, BALL_MS));
      return;
    }
    setReveal({ event, shown: 0, carried, done: false, replay });
    event.numbers.forEach((_, i) =>
      timers.current.push(
        setTimeout(() => {
          setReveal((r) => (r && r.event.number === event.number ? { ...r, shown: i + 1 } : r));
          play("lottery.ball");
        }, BALL_MS * (i + 1))
      )
    );
    timers.current.push(setTimeout(finish, REVEAL_TOTAL_MS));
  }, []);

  // a live draw always wins the stage, a replay included
  const startReveal = useCallback(
    (drawn: DrawnEvent) => {
      const open = openDrawRef.current;
      const carried = open && open.number === drawn.number ? open.carried : 0;
      if (userIdRef.current) markSeen(userIdRef.current, drawn.number);
      runBalls(drawn, carried, null, () => finishReveal(drawn.number));
    },
    [finishReveal, runBalls]
  );

  // the prize was paid at the real draw, so a replay reads its result off the page and asks the server nothing
  const startReplay = useCallback(
    (settled: SettledDraw, me: LotteryMe | null, kind: ReplayKind) => {
      const outcome = outcomeOf(me && me.last && me.last.number === settled.number ? me.last : null);
      if (userIdRef.current) markSeen(userIdRef.current, settled.number);
      runBalls(eventOf(settled), 0, kind, () => {
        setReveal((r) => (r && r.event.number === settled.number ? { ...r, shown: r.event.numbers.length, done: true } : r));
        holdResult(settled.number, outcome);
      });
    },
    [runBalls, holdResult]
  );

  useEffect(() => {
    const socket = SocketConnection.getInstance();
    const onPot = (pot: PotUpdate) =>
      setState((prev) =>
        prev && prev.draw && prev.draw.number === pot.draw ? { ...prev, draw: { ...prev.draw, jackpot: pot.jackpot, tickets: pot.tickets } } : prev
      );
    socket.on("lottery:pot", onPot);
    socket.on("lottery:drawn", startReveal);
    return () => {
      socket.off("lottery:pot", onPot);
      socket.off("lottery:drawn", startReveal);
    };
  }, [startReveal]);

  const draw = state ? state.draw : null;
  openDrawRef.current = draw;
  const drawAt = draw ? Date.parse(draw.drawAt) : 0;
  const salesOpen = !!draw && draw.status === "open" && now < Date.parse(draw.salesCloseAt);
  const live = reveal && !reveal.replay ? reveal : null;
  // the real draw is under way, on the stage or still to arrive once the clock has run out
  const liveDue = !!live || (!!draw && (draw.status !== "open" || now >= drawAt));

  // a missed socket event must not leave the page on a draw that has already happened
  useEffect(() => {
    if (!draw || live || now < drawAt + LATE_AFTER_MS) return;
    if (Date.now() - lastLoad.current < LATE_POLL_MS) return;
    load().then((next) => {
      if (next && next.draw && next.draw.number !== draw.number) setHistoryTick((n) => n + 1);
    });
  }, [now, draw, drawAt, live, load]);

  // a player who had tickets in the last draw and was not here for it sees it once, if it can finish before the next one.
  // the account is read, not followed: after a switch the old account's tickets stay in the state until the reload lands
  useEffect(() => {
    const id = userIdRef.current;
    const settled = state ? state.last : null;
    const me = state ? state.me : null;
    if (!id || !settled || !me || !me.last || me.last.number !== settled.number || !me.last.tickets.length) return;
    if (seenDraw(id) >= settled.number || reveal) return;
    const open = state ? state.draw : null;
    if (open && (open.status !== "open" || Date.parse(open.drawAt) - serverNow() <= REPLAY_MS)) return;
    if (reducedMotion()) {
      markSeen(id, settled.number);
      return;
    }
    startReplay(settled, me, "auto");
  }, [state, reveal, startReplay]);

  const held = state && state.me ? state.me.count : 0;
  const room = slipRoom(held, slip.length);
  const walletBalance: number = userData?.walletBalance ?? 0;
  const total = slipTotal(slip);
  const locked = verification.needed && verification.enforced;

  const toggle = (n: number) => {
    const next = togglePick(pick, n);
    if (next === pick) return;
    setPick(next);
    play("lottery.pick");
  };

  const fillPick = () => {
    setPick(quickPick());
    play("lottery.pick");
  };

  const addPick = () => {
    if (pick.length !== PICK || room === 0) return;
    setSlip(addToSlip(slip, pick, held));
    setPick([]);
  };

  const addMany = (count: number) => {
    if (room === 0) return;
    setSlip(addQuickPicks(slip, count, held));
    play("lottery.pick");
  };

  const lastTickets = state && state.me && state.me.last ? state.me.last.tickets.map((t) => t.numbers) : [];
  const repeatLast = () => {
    if (room === 0 || !salesOpen || !lastTickets.length) return;
    setSlip(repeatTickets(slip, lastTickets, held));
    play("lottery.pick");
  };
  const repeat: MainAction | null = lastTickets.length
    ? { label: i18n.t("lottery.repeatLast", { count: lastTickets.length }), onClick: repeatLast, disabled: room === 0 || !salesOpen }
    : null;

  const buy = async () => {
    if (userData == null) {
      toogleUserFlow(true);
      return;
    }
    if (buying || slip.length === 0) return;
    if (walletBalance < total) {
      toast.error(i18n.t("blackjack.insufficientFunds"), { theme: "dark" });
      return;
    }
    setBuying(true);
    play("game.bet");
    try {
      const res = await buyLotteryTickets(slip);
      setSlip([]);
      setState((prev) =>
        prev
          ? {
              ...prev,
              draw: prev.draw && prev.draw.number === res.draw.number ? { ...prev.draw, jackpot: res.draw.jackpot, tickets: res.draw.tickets } : prev.draw,
              me: {
                last: prev.me ? prev.me.last : null,
                tickets: [...(prev.me ? prev.me.tickets : []), ...res.tickets],
                count: res.me.count,
                left: res.me.left,
              },
            }
          : prev
      );
      toogleUserData((prev: { walletBalance: number } | null) => (prev ? { ...prev, walletBalance: res.balance } : prev));
      toast.success(i18n.t("lottery.bought", { count: res.tickets.length, number: res.draw.number }), { theme: "dark" });
    } catch (error) {
      if (handleAccountLock(error, "lottery")) return;
      const response = errorOf(error);
      toast.error(response?.data?.message || i18n.t("lottery.couldNotBuy"), { theme: "dark" });
      // the draw moved on, or the cap is not what this page thought: ask for the truth
      if (response?.status === 409) load();
    } finally {
      setBuying(false);
    }
  };

  const runCheck = async (d: SettledDraw) => {
    if (!canVerify()) {
      setChecks((prev) => ({ ...prev, [d.number]: { running: false, ok: false, text: i18n.t("lottery.verifyUnsupported") } }));
      return;
    }
    setChecks((prev) => ({ ...prev, [d.number]: { running: true, ok: null, text: null } }));
    try {
      const check = await checkDraw(d);
      const ok = check.commitmentValid && check.outcomeValid;
      setChecks((prev) => ({
        ...prev,
        [d.number]: { running: false, ok, text: ok ? i18n.t("lottery.verified", { numbers: check.recomputed.join(", ") }) : i18n.t("lottery.notVerified") },
      }));
    } catch {
      setChecks((prev) => ({ ...prev, [d.number]: { running: false, ok: false, text: i18n.t("lottery.verifyUnsupported") } }));
    }
  };

  const toggleDraw = (d: SettledDraw) => {
    const opening = openDraw !== d.number;
    setOpenDraw(opening ? d.number : null);
    if (opening && userData && !mineIn[d.number]) {
      getDrawTickets(d.number)
        .then((res) => setMineIn((prev) => ({ ...prev, [d.number]: res.tickets })))
        .catch(() => undefined);
    }
  };

  const action: MainAction =
    userData == null
      ? { label: i18n.t("upgrade.signInToPlay"), onClick: () => toogleUserFlow(true), disabled: false }
      : !salesOpen
        ? { label: i18n.t("lottery.salesClosed"), onClick: () => undefined, disabled: true }
        : locked
          ? {
              label: i18n.t("lottery.verifyToBuy"),
              onClick: () => {
                toast.info(i18n.t("verify.locked.lottery"), { theme: "dark" });
                openVerify();
              },
              disabled: false,
            }
          : slip.length === 0
            ? { label: i18n.t("lottery.addFirst"), onClick: () => undefined, disabled: true }
            : { label: i18n.t("lottery.buy", { count: slip.length, total: kpText(total) }), onClick: buy, disabled: buying || walletBalance < total };

  // the tickets the player holds in a draw: the open one, or the one just settled once the page has moved on
  const ticketsIn = (number: number): LotteryTicket[] => {
    const me = state ? state.me : null;
    if (!me) return [];
    if (draw && draw.number === number) return me.tickets;
    return me.last && me.last.number === number ? me.last.tickets : [];
  };

  const out = reveal ? reveal.event.numbers.slice(0, reveal.shown) : [];
  const mine = new Set([...(reveal ? ticketsIn(reveal.event.number).flatMap((t) => t.numbers) : []), ...pick]);
  // a replay leaves the pot, its rolling badge and the clock on the open draw; only the live draw takes them over
  const carried = live ? live.carried : draw ? draw.carried : 0;
  // flat out while the balls come out and once the clock has run down, brisk while sales are closed, a lazy roll otherwise
  const speed: DrumSpeed =
    (reveal && !reveal.done) || (!live && draw && now >= drawAt) ? "drawing" : !live && draw && !salesOpen ? "closed" : "open";
  const status = reveal
    ? reveal.done
      ? result
        ? result.text
        : jackpotLine(reveal.event)
      : reveal.replay
        ? i18n.t("lottery.replayOf", { number: reveal.event.number })
        : ""
    : !draw
      ? failed
        ? i18n.t("lottery.couldNotLoad")
        : ""
      : salesOpen
        ? i18n.t("lottery.sold", { count: draw.tickets })
        : i18n.t("lottery.closed");

  const prizes: PrizeRow[] = TIERS.map(({ k, label }) => ({
    label: i18n.t(label),
    value: k === PICK ? i18n.t("lottery.jackpot") : kpText(PRIZES[k]),
    top: k === PICK,
  }));

  const sortedPick = sortPick(pick);
  const stage: StageView = {
    ready: !!draw || !!reveal,
    jackpot: live ? kpText(live.event.jackpot) : draw ? kpText(draw.jackpot) : reveal ? kpText(reveal.event.jackpot) : "",
    rolling: carried > 0 ? i18n.t("lottery.rolling", { count: carried }) : null,
    clockLabel: live ? i18n.t("lottery.drawing", { number: live.event.number }) : draw ? i18n.t("lottery.drawIn", { number: draw.number }) : "",
    countdown: live ? formatCountdown(0) : draw ? formatCountdown(drawAt - now) : null,
    status,
    won: !!(reveal && reveal.done && result && result.won),
    speed,
    drum: NUMBERS.filter((n) => !out.includes(n)),
    drumLabel: i18n.t("lottery.drumLabel"),
    tray: Array.from({ length: PICK }, (_, i): BallView => (i < out.length ? { n: out[i], tone: mine.has(out[i]) ? "hit" : "drawn" } : { n: null, tone: "pending" })),
    trayLabel: i18n.t("lottery.trayLabel"),
    drop: !reducedMotion(),
    pick: Array.from({ length: PICK }, (_, i): BallView =>
      i < sortedPick.length ? { n: sortedPick[i], tone: out.includes(sortedPick[i]) ? "hit" : "plain" } : { n: null, tone: "pending" }
    ),
    prizes,
  };

  const grid: GridCell[] = NUMBERS.map((n) => ({ n, picked: pick.includes(n), muted: pick.length >= PICK && !pick.includes(n) }));
  const quickMany: QuickMany[] = QUICK_MANY.map((n) => ({ n, label: i18n.t("lottery.quickPickMany", { n }), disabled: room === 0 }));
  const slipRows: SlipRow[] = slip.map((numbers, i) => ({ key: `${i}-${numbers.join("-")}`, numbers, remove: () => setSlip(removeFromSlip(slip, i)) }));

  const last = state ? state.last : null;
  const lastMine = last && state && state.me && state.me.last && state.me.last.number === last.number ? state.me.last : null;
  // the card would give away the replay a player is watching for the first time, until its last ball is in the tray
  const spoils = !!(reveal && reveal.replay === "auto" && last && reveal.event.number === last.number && reveal.shown < reveal.event.numbers.length);
  const lastDraw: LastDrawView | null = last
    ? {
        title: i18n.t("lottery.draw", { number: last.number }),
        date: dateOf(last.drawAt),
        watching: spoils ? i18n.t("lottery.watching") : null,
        watch: {
          label: i18n.t("lottery.watchDraw"),
          onClick: () => {
            if (!reveal && !liveDue) startReplay(last, state ? state.me : null, "watch");
          },
          disabled: !!reveal || liveDue,
        },
        balls: ballsOf(last.numbers),
        jackpotLine: jackpotLine(last),
        tiers: [
          { label: i18n.t("lottery.tier2"), value: i18n.t("lottery.winningTickets", { count: last.winners.m2 }) },
          { label: i18n.t("lottery.tier1"), value: i18n.t("lottery.winningTickets", { count: last.winners.m1 }) },
        ],
        mine: lastMine ? ticketRows(lastMine.tickets, last.numbers) : [],
        total:
          lastMine && lastMine.tickets.length
            ? lastMine.won > 0
              ? i18n.t("lottery.yourTotal", { amount: kpText(lastMine.won) })
              : i18n.t("lottery.yourTotalNone")
            : null,
      }
    : null;

  const checkOf = (d: SettledDraw): CheckView => {
    const c = checks[d.number];
    return { running: !!c && c.running, ok: c ? c.ok : null, text: c ? c.text : null, run: () => runCheck(d) };
  };

  const historyRows: HistoryRow[] = (history ? history.draws : []).map((d) => {
    // the same draw sits at the top of the history, so it is held back for as long as the card is
    const hidden = spoils && d.number === last?.number;
    return {
      number: d.number,
      label: i18n.t("lottery.draw", { number: d.number }),
      date: dateOf(d.drawAt),
      balls: hidden ? d.numbers.map((): BallView => ({ n: null, tone: "pending" })) : ballsOf(d.numbers),
      jackpot: kpText(d.jackpot),
      outcome: hidden ? "" : d.jackpotWinners.length ? i18n.t("lottery.won") : i18n.t("lottery.rolled"),
      won: !hidden && d.jackpotWinners.length > 0,
      open: openDraw === d.number,
      toggle: () => toggleDraw(d),
      details:
        openDraw === d.number && !hidden
          ? { seedHash: d.seedHash, serverSeed: d.serverSeed, check: checkOf(d), mine: ticketRows(mineIn[d.number] || [], d.numbers) }
          : null,
    };
  });

  const pager: Pager | null =
    history && history.pages > 1
      ? {
          label: i18n.t("lottery.page", { page: history.page, pages: history.pages }),
          newer: history.page > 1 ? () => setHistoryPage(history.page - 1) : null,
          older: history.page < history.pages ? () => setHistoryPage(history.page + 1) : null,
        }
      : null;

  return {
    stage,
    panel: {
      grid,
      toggle,
      pickHint: i18n.t("lottery.picked", { n: pick.length }),
      fillPick,
      addPick,
      canAdd: pick.length === PICK && room > 0,
      quickMany,
      addMany,
      repeat,
      slip: slipRows,
      clearSlip: slip.length ? () => setSlip([]) : null,
      total: slip.length ? kpText(total) : null,
      held: userData ? i18n.t("lottery.held", { count: held, cap: CAP }) : null,
      full: userData && held >= CAP ? i18n.t("lottery.full") : null,
      action,
    },
    myTickets:
      userData && draw
        ? {
            title: i18n.t("lottery.myTickets", { number: draw.number }),
            rows: state && state.me ? state.me.tickets.map((t, i) => ({ key: `${i}-${t.numbers.join("-")}`, balls: ballsOf(t.numbers, "plain") })) : [],
            empty: i18n.t("lottery.myTicketsEmpty"),
          }
        : null,
    lastDraw,
    history: { rows: historyRows, pager, empty: history && history.draws.length === 0 ? i18n.t("lottery.historyEmpty") : null },
  };
};
