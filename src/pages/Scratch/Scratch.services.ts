import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { buyScratch, getActiveScratch, pickScratch } from "../../services/games/GamesServices";
import { useSessionStats } from "../../stats/SessionStatsContext";
import { play } from "../../services/sound/sound";
import i18n from "../../i18n";
import {
  BIG_WIN_MULTIPLIER,
  TICKETS,
  findSymbol,
  kpText,
  quantitiesOf,
  ticketOf,
  topPrize,
  type PickTicket,
  type Ticket,
  type TicketId,
} from "./scratchTickets";
import { TICKET_LOOK } from "./ticketLook";
import type {
  Board,
  CatalogueCard,
  CellMark,
  CoatingState,
  FinishedActions,
  KeyRow,
  MainAction,
  NineResult,
  PanelKey,
  PanelView,
  PickAnswer,
  Pip,
  PocketResult,
  ResultLine,
  Stage,
  StackPurchase,
  StackSummary,
  StackTicket,
  TicketDetails,
  TicketProgress,
  TreasurePurchase,
  TreasureSpot,
  TreasureView,
} from "./Scratch.types";

// the reveal-all wipe; the coating's clip transition runs exactly this long
export const WIPE_MS = 300;
const DEFAULT_TICKET: TicketId = "pocket";
const SPOTS = 9;
const TREASURE = ticketOf("treasure") as PickTicket;

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const grouped = (n: number) => n.toLocaleString("en-US");
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

// the serial printed on the foot: the last seven digits of the roll or ticket id, and a card number spun from them
export const serialOf = (id: string | null) => {
  const digits = id ? id.replace(/\D/g, "").padStart(7, "0").slice(-7) : null;
  return digits ? `${digits.slice(0, 4)} ${digits.slice(4)}` : "---- ---";
};
export const codeOf = (id: string | null) => {
  const digits = (id || "").replace(/\D/g, "") || "0";
  const spun = (digits + [...digits].reverse().join("")).repeat(4).slice(0, 16).padEnd(16, "0");
  return spun.match(/.{4}/g)?.join(" ") || "";
};

const isPocket = (ticket: StackTicket): ticket is PocketResult => "cells" in ticket;
const isNine = (ticket: StackTicket): ticket is NineResult => "spots" in ticket;
const isTreasurePurchase = (res: StackPurchase | TreasurePurchase): res is TreasurePurchase => "game" in res && !!res.game;

interface Spot {
  find: number | null;
  scratched: boolean;
}

interface Settled {
  board: number[];
  payout: number;
  balance: number | null;
  rollId: string | null;
}

interface Treasure {
  id: string;
  price: number;
  picks: Record<number, Spot>;
  // the picked cells in the order they were committed, for the panel's pips
  order: number[];
  // bumped when a failed pick hands a spot back, so its coating mounts again with the foil whole
  gen: Record<number, number>;
  settled: Settled | null;
  finished: boolean;
}

type WalletUpdate = (prev: { walletBalance: number } | null) => unknown;

const settledOf = (view: TreasureView, balance: number | null): Settled | null =>
  view.status === "settled" && view.board
    ? { board: view.board, payout: view.payout, balance, rollId: view.rollId }
    : null;

// a ticket from the server: spots picked before this page are shown already scratched
const fromView = (view: TreasureView): Treasure => ({
  id: view.id,
  price: view.price,
  picks: Object.fromEntries(view.picks.map((p) => [p.cell, { find: p.find, scratched: true }])),
  order: view.picks.map((p) => p.cell),
  gen: {},
  settled: null,
  finished: false,
});

const ruleLines = (def: Ticket) => (def.kind === "lucky" ? [t("scratch.rules.nine"), t("scratch.rules.nineMultiplier")] : [t(`scratch.rules.${def.id}`)]);

const keyRows = (def: Ticket): KeyRow[] | null => {
  if (def.kind === "line") return [...def.prizes].reverse().map(([symbol, m]) => ({ symbol, times: "×3", prize: kpText(m * def.price) }));
  if (def.kind === "pick") return def.finds.map(([symbol, amount]) => ({ symbol, times: null, prize: kpText(amount) }));
  return null;
};

const panelKey = (def: Ticket): PanelKey => {
  if (def.kind !== "lucky") return { kind: "rows", rows: keyRows(def) || [] };
  const multipliers = [...new Set([...def.outcomes.map(([, , m]) => m), ...def.lossMultipliers])].sort((a, b) => a - b);
  return {
    kind: "chips",
    groups: [
      { label: t("scratch.prizes"), values: def.printable.map((m) => kpText(m * def.price)) },
      { label: t("scratch.multipliers"), values: multipliers.map((m) => `×${m}`) },
    ],
  };
};

// a payout under the price is money back, not a win: it gets its own neutral line and no win or lose sound
const toneOf = (payout: number, price: number) => (payout >= price ? "won" : payout > 0 ? "found" : "lost");

const stackResult = (ticket: StackTicket, price: number): ResultLine => {
  if (ticket.payout <= 0) return { kind: "lost", text: t(isPocket(ticket) ? "scratch.noLine" : "scratch.noMatch") };
  const amount = kpText(ticket.payout);
  if (ticket.payout < price) return { kind: "found", text: t("scratch.found", { amount }) };
  if (isPocket(ticket)) return { kind: "won", text: t("scratch.lineWin", { symbols: t(`scratch.plural.${ticket.symbol}`), amount }) };
  const count = ticket.winningSpots.length;
  const text =
    ticket.multiplier > 1 ? t("scratch.nineWinTimes", { count, multiplier: ticket.multiplier, amount }) : t("scratch.nineWin", { count, amount });
  return { kind: "won", text };
};

export const useScratchServices = () => {
  const { userData, toogleUserData, toogleUserFlow } = useContext(UserContext);
  const { track } = useSessionStats();
  const navigate = useNavigate();
  const isLogged = userData != null;

  const [ticketId, setTicketId] = useState<TicketId>(DEFAULT_TICKET);
  const [quantity, setQuantity] = useState<number>(1);
  const [buying, setBuying] = useState(false);
  const [stack, setStack] = useState<StackPurchase | null>(null);
  const [seq, setSeq] = useState(0);
  const [index, setIndex] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [coating, setCoating] = useState<CoatingState>("covered");
  const [treasure, setTreasureState] = useState<Treasure | null>(null);
  const [bigWin, setBigWin] = useState<number | null>(null);

  // the wipe timer, the pick answers and the unmount outlive the render that set them up, so they read these instead of state
  const resolvedRef = useRef(0);
  const wipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef<{ purchase: StackPurchase; settled: boolean } | null>(null);
  const treasureRef = useRef<Treasure | null>(null);
  const setUser = useRef<(update: WalletUpdate) => void>(toogleUserData);
  setUser.current = toogleUserData;
  const stageRef = useRef<HTMLDivElement>(null);

  // on a phone the buy button sits under the board, so a fresh ticket would land above the fold
  const showStage = () =>
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage || stage.getBoundingClientRect().top >= 0) return;
      const calm = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      stage.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    });

  const updateTreasure = (next: (prev: Treasure | null) => Treasure | null) => {
    treasureRef.current = next(treasureRef.current);
    setTreasureState(treasureRef.current);
    return treasureRef.current;
  };

  // the server pushed the balance after the charge only, so the wallet never spoils a ticket before it is scratched
  const addToWallet = (amount: number) => {
    if (amount > 0) setUser.current((prev) => (prev ? { ...prev, walletBalance: prev.walletBalance + amount } : prev));
  };
  const setWallet = (amount: number) => setUser.current((prev) => (prev ? { ...prev, walletBalance: amount } : prev));

  const settleStack = (p: StackPurchase) => {
    const s = shown.current;
    if (!s || s.purchase !== p || s.settled) return;
    s.settled = true;
    setWallet(p.balance);
  };

  const celebrate = (payout: number, price: number) => {
    const tone = toneOf(payout, price);
    if (tone !== "found") play(tone === "won" ? "game.win" : "game.lose");
    if (payout > 0 && payout / price >= BIG_WIN_MULTIPLIER) {
      setBigWin(payout);
      play("game.bigwin");
    }
  };

  // every ticket up to and including `upTo`, in order; a whole stack at once gets one sound, not ten
  const reveal = (p: StackPurchase, upTo: number) => {
    if (upTo < resolvedRef.current) return;
    let won = 0;
    let best = 0;
    for (let i = resolvedRef.current; i <= upTo; i++) {
      const ticket = p.tickets[i];
      addToWallet(ticket.payout);
      track({ game: "scratch", wagered: p.price, payout: ticket.payout });
      won += ticket.payout;
      best = Math.max(best, ticket.payout);
    }
    resolvedRef.current = upTo + 1;
    setResolved(upTo + 1);
    play("scratch.reveal");
    celebrate(won > 0 ? best : 0, p.price);
    if (upTo === p.quantity - 1) settleStack(p);
  };

  // the third spot is scratched and the board is in: show the rest, then the balance the server gave with the last pick
  const finishIfDone = () => {
    const tr = treasureRef.current;
    if (!tr || tr.finished || !tr.settled) return;
    const spots = Object.values(tr.picks);
    if (spots.length < TREASURE.picks || spots.some((s) => !s.scratched || s.find === null)) return;
    const settled = tr.settled;
    updateTreasure((prev) => (prev ? { ...prev, finished: true } : prev));
    if (settled.balance !== null) setWallet(settled.balance);
    track({ game: "scratch", wagered: tr.price, payout: settled.payout });
    celebrate(settled.payout, tr.price);
  };

  const def = ticketOf(stack ? stack.ticket : treasure ? "treasure" : ticketId);
  const stackInPlay = !!stack && resolved < stack.quantity;
  const treasureInPlay = !!treasure && !treasure.finished;
  const inPlay = stackInPlay || treasureInPlay;
  const current = stack ? stack.tickets[index] : null;
  const currentDone = !!stack && resolved > index;
  const walletBalance: number = userData?.walletBalance ?? 0;
  const total = def.price * quantity;
  const canChoose = !inPlay && !buying;

  const startTreasure = (view: TreasureView) => {
    shown.current = null;
    setStack(null);
    setTicketId("treasure");
    setQuantity(1);
    setBigWin(null);
    updateTreasure(() => fromView(view));
  };

  const buy = async () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }
    if (buying || inPlay) return;
    if (walletBalance < total) {
      toast.error(t("blackjack.insufficientFunds"), { theme: "dark" });
      return;
    }
    setBuying(true);
    play("game.bet");
    play("scratch.buy");
    try {
      const res: StackPurchase | TreasurePurchase = await buyScratch(def.id, quantity);
      setWallet(res.balanceAfterCharge);
      if (isTreasurePurchase(res)) {
        startTreasure(res.game);
      } else {
        shown.current = { purchase: res, settled: false };
        resolvedRef.current = 0;
        updateTreasure(() => null);
        setStack(res);
        setSeq((n) => n + 1);
        setIndex(0);
        setResolved(0);
        setCoating("covered");
        setBigWin(null);
      }
      showStage();
    } catch (error) {
      toast.error(errorMessage(error) || t("scratch.couldNotBuy"), { theme: "dark" });
    } finally {
      setBuying(false);
    }
  };

  // the coating says the player scratched enough of it away
  const completeTicket = () => {
    if (!stack || currentDone) return;
    setCoating("faded");
    reveal(stack, index);
  };

  const revealAll = () => {
    if (!stack || currentDone || coating !== "covered") return;
    setCoating("wiping");
    const p = stack;
    const i = index;
    wipeTimer.current = setTimeout(() => {
      wipeTimer.current = null;
      setCoating("wiped");
      reveal(p, i);
    }, WIPE_MS);
  };

  const nextTicket = () => {
    if (!stack || !currentDone || index >= stack.quantity - 1) return;
    setIndex(index + 1);
    setCoating("covered");
    setBigWin(null);
  };

  const revealStack = () => {
    if (!stack || !stackInPlay) return;
    if (wipeTimer.current) clearTimeout(wipeTimer.current);
    wipeTimer.current = null;
    const last = stack.quantity - 1;
    setIndex(last);
    setCoating("wiped");
    reveal(stack, last);
  };

  // a spot is claimed once the coating says it was really rubbed (past its commit point), and the server answers with what
  // is under it; a tap or a scroll that starts on a spot never gets here
  const claimSpot = (cell: number) => {
    const tr = treasureRef.current;
    if (!tr || tr.finished) return false;
    if (tr.picks[cell]) return true;
    if (Object.keys(tr.picks).length >= TREASURE.picks) return false;
    const id = tr.id;
    updateTreasure((prev) =>
      prev ? { ...prev, picks: { ...prev.picks, [cell]: { find: null, scratched: false } }, order: [...prev.order, cell] } : prev
    );
    pickScratch(id, cell)
      .then((answer: PickAnswer) => {
        updateTreasure((prev) => {
          if (!prev || prev.id !== id) return prev;
          const spot = prev.picks[cell] || { find: null, scratched: false };
          return { ...prev, picks: { ...prev.picks, [cell]: { ...spot, find: answer.find } }, settled: settledOf(answer, answer.balance ?? null) || prev.settled };
        });
        finishIfDone();
      })
      .catch((error) => {
        updateTreasure((prev) => {
          if (!prev || prev.id !== id) return prev;
          const picks = { ...prev.picks };
          delete picks[cell];
          return { ...prev, picks, order: prev.order.filter((c) => c !== cell), gen: { ...prev.gen, [cell]: (prev.gen[cell] || 0) + 1 } };
        });
        toast.error(errorMessage(error) || t("scratch.couldNotPick"), { theme: "dark" });
      });
    return true;
  };

  const completeSpot = (cell: number) => {
    updateTreasure((prev) => (prev && prev.picks[cell] ? { ...prev, picks: { ...prev.picks, [cell]: { ...prev.picks[cell], scratched: true } } } : prev));
    play("scratch.reveal");
    finishIfDone();
  };

  const selectTicket = (id: TicketId) => {
    if (!canChoose) return;
    setTicketId(id);
    setQuantity((q) => (quantitiesOf(ticketOf(id)).includes(q) ? q : 1));
  };

  const chooseQuantity = (n: number) => {
    if (canChoose && quantitiesOf(def).includes(n)) setQuantity(n);
  };

  const backToCatalogue = () => {
    if (inPlay) return;
    shown.current = null;
    setStack(null);
    updateTreasure(() => null);
    setBigWin(null);
  };

  // a ticket left open last time, here or on another device, opens straight into play
  useEffect(() => {
    if (!isLogged) return;
    let live = true;
    getActiveScratch()
      .then((res: { game: TreasureView | null }) => {
        if (!live || !res?.game || treasureRef.current) return;
        shown.current = null;
        setStack(null);
        setTicketId("treasure");
        setQuantity(1);
        treasureRef.current = fromView(res.game);
        setTreasureState(treasureRef.current);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isLogged]);

  // leaving with tickets still covered: their prizes are already paid, so the wallet shows the truth
  useEffect(() => {
    const timer = wipeTimer;
    const stackShown = shown;
    const user = setUser;
    const ticket = treasureRef;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      const s = stackShown.current;
      if (s && !s.settled) {
        s.settled = true;
        user.current((prev) => (prev ? { ...prev, walletBalance: s.purchase.balance } : prev));
      }
      const tr = ticket.current;
      const balance = tr && !tr.finished && tr.settled ? tr.settled.balance : null;
      if (balance !== null) user.current((prev) => (prev ? { ...prev, walletBalance: balance } : prev));
    };
  }, []);

  // the overlay goes on the next touch anywhere, the way the slots one does
  useEffect(() => {
    if (bigWin === null) return;
    const close = () => setBigWin(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [bigWin]);

  const look = TICKET_LOOK[def.id];
  const name = t(`scratch.names.${def.id}`);
  const claimed = treasure ? Object.keys(treasure.picks).length : 0;
  const picksAllowed = def.kind === "pick" ? def.picks : 0;
  const left = Math.max(0, picksAllowed - claimed);

  const detailsOf = (ticket: Ticket): TicketDetails => ({
    id: ticket.id,
    label: t("scratch.ticket"),
    name: t(`scratch.names.${ticket.id}`),
    price: kpText(ticket.price),
    rules: ruleLines(ticket),
    key: panelKey(ticket),
  });
  const details = detailsOf(def);

  const action: MainAction = !isLogged
    ? { label: t("upgrade.signInToPlay"), onClick: () => toogleUserFlow(true), disabled: false }
    : stackInPlay && !currentDone
      ? { label: t("scratch.revealAll"), onClick: revealAll, disabled: coating !== "covered" }
      : stackInPlay
        ? { label: t("scratch.nextTicket"), onClick: nextTicket, disabled: false }
        : treasureInPlay
          ? { label: t("scratch.spotsLeft", { count: left }), onClick: () => undefined, disabled: true }
          : { label: t("scratch.buy", { n: quantity, total: kpText(total) }), onClick: buy, disabled: buying || walletBalance < total };

  const done = !!((stack && !stackInPlay) || (treasure && treasure.finished));
  const finished: FinishedActions = {
    shown: done,
    buyAgain: { label: t("scratch.buyAgain"), onClick: buy, disabled: !done || buying || walletBalance < total },
    back: { label: t("scratch.backToCatalogue"), onClick: backToCatalogue, disabled: !done || buying },
  };

  const markOf = (i: number, winning: number[]): CellMark => (!currentDone ? "plain" : winning.includes(i) ? "win" : "dim");

  const zoneCoating = {
    key: `${seq}-${index}`,
    label: t("scratch.coating"),
    active: stackInPlay && !currentDone && coating === "covered",
    state: coating,
    onRub: () => play("scratch.rub"),
    onComplete: completeTicket,
  };

  const treasureSpots = (tr: Treasure, pickDef: PickTicket): TreasureSpot[] =>
    Array.from({ length: SPOTS }, (_, cell) => {
      const spot = tr.picks[cell];
      const value = spot?.find ?? (tr.finished && tr.settled ? tr.settled.board[cell] : null);
      const open = !!spot && spot.scratched && spot.find !== null;
      return {
        cell,
        find: value === null ? null : { symbol: findSymbol(pickDef, value), amount: value > 0 ? grouped(value) : "" },
        mark: tr.finished ? (spot ? "kept" : "missed") : open ? "open" : "covered",
        coating: {
          key: `${tr.id}-${cell}-${tr.gen[cell] || 0}`,
          active: !tr.finished && !(spot && spot.scratched) && (!!spot || claimed < pickDef.picks),
          state: open || tr.finished ? "faded" : "covered",
          onStart: () => claimSpot(cell),
          onRub: () => play("scratch.rub"),
          onComplete: () => completeSpot(cell),
        },
      };
    });

  const board: Board | null =
    treasure && def.kind === "pick"
      ? { kind: "treasure", emptyLabel: t("scratch.empty"), spots: treasureSpots(treasure, def) }
      : current && isPocket(current)
        ? { kind: "pocket", cells: current.cells.map((symbol, i) => ({ symbol, mark: markOf(i, current.winningCells) })), coating: zoneCoating }
        : current && isNine(current)
          ? {
              kind: "nine",
              luckyLabel: t("scratch.lucky"),
              multiplierLabel: t("scratch.multiplier"),
              lucky: current.lucky,
              multiplier: `×${current.multiplier}`,
              spots: current.spots.map((spot, i) => ({ symbol: spot.symbol, prize: grouped(spot.prize), mark: markOf(i, current.winningSpots) })),
              coating: zoneCoating,
            }
          : null;

  const treasureResult = (tr: Treasure): ResultLine | null => {
    if (!tr.finished || !tr.settled) return null;
    const amount = kpText(tr.settled.payout);
    const tone = toneOf(tr.settled.payout, tr.price);
    const text =
      tone === "won" ? t("scratch.treasureWon", { amount }) : tone === "found" ? t("scratch.found", { amount }) : t("scratch.treasureNothing");
    return { kind: tone, text };
  };

  const result: ResultLine | null = treasure
    ? treasureResult(treasure)
    : current && currentDone && stack
      ? stackResult(current, stack.price)
      : null;

  const best = stack ? stack.tickets.reduce((b, ticket) => (ticket.payout > b.payout ? ticket : b), stack.tickets[0]) : null;
  const summary: StackSummary | null =
    stack && !stackInPlay && best && stack.quantity > 1
      ? {
          count: String(stack.quantity),
          won: kpText(stack.totalPayout),
          best: best.payout > 0 ? t("scratch.bestValue", { multiplier: best.payout / stack.price, amount: kpText(best.payout) }) : t("scratch.noWins"),
        }
      : null;
  const wonSoFar = stack ? stack.tickets.slice(0, resolved).reduce((sum, ticket) => sum + ticket.payout, 0) : 0;

  const rollId = treasure ? (treasure.finished ? treasure.settled?.rollId || null : null) : current && currentDone ? current.rollId : null;
  const serialId = treasure ? treasure.settled?.rollId || treasure.id : current ? current.rollId : null;
  const ticketRules =
    def.kind === "pick" ? [`${t("scratch.rules.treasure")} ${t("scratch.left", { count: left })}`] : ruleLines(def);

  // past the last ticket it applies to, the button keeps its space so the panel never changes height mid-stack
  const showRevealStack = stackInPlay && (stack?.quantity ?? 0) > 1 && (stack?.quantity ?? 0) - resolved > (currentDone ? 0 : 1);

  const cards: CatalogueCard[] = TICKETS.map((ticket) => ({
    id: ticket.id,
    look: TICKET_LOOK[ticket.id],
    name: t(`scratch.names.${ticket.id}`),
    series: t("scratch.series", { n: TICKET_LOOK[ticket.id].series }),
    price: kpText(ticket.price),
    rule: t(`scratch.rules.${ticket.id}`),
    topLabel: t("scratch.topPrize"),
    top: kpText(topPrize(ticket)),
    selected: ticket.id === ticketId,
  }));

  const pipOf = (payout: number, price: number, current: boolean): Pip => ({ mark: toneOf(payout, price), current });

  const stackProgress = (p: StackPurchase): TicketProgress => {
    const head = { label: details.label, name, price: kpText(p.price) };
    if (p.quantity === 1) return { ...head, pips: null, lines: [], heldLines: 0 };
    const items = p.tickets.map((ticket, i) =>
      i < resolved ? pipOf(ticket.payout, p.price, i === index) : { mark: "unscratched" as const, current: i === index }
    );
    const lines = stackInPlay
      ? [{ label: t("scratch.wonSoFar"), value: kpText(wonSoFar) }]
      : [
          { label: t("scratch.summaryWon"), value: kpText(p.totalPayout) },
          { label: t("scratch.summaryBest"), value: summary?.best || t("scratch.noWins") },
        ];
    return {
      ...head,
      pips: { label: t("scratch.counter", { n: index + 1, total: p.quantity }), items },
      lines,
      heldLines: stackInPlay ? 1 : 0,
    };
  };

  // a pick counts once it is committed, and shows what it found only once its spot is scratched
  const treasureProgress = (tr: Treasure): TicketProgress => {
    const items = Array.from({ length: TREASURE.picks }, (_, k): Pip => {
      const spot = k < tr.order.length ? tr.picks[tr.order[k]] : null;
      if (!spot) return { mark: "unscratched", current: false };
      return spot.scratched && spot.find !== null ? pipOf(spot.find, tr.price, false) : { mark: "unscratched", current: true };
    });
    const found = tr.order.reduce((sum, cell) => sum + (tr.picks[cell]?.scratched ? tr.picks[cell].find || 0 : 0), 0);
    return {
      label: details.label,
      name,
      price: kpText(tr.price),
      pips: { label: t("scratch.spotsLeft", { count: left }), items },
      lines: [{ label: t(tr.finished ? "scratch.totalFound" : "scratch.foundSoFar"), value: kpText(found) }],
      heldLines: 0,
    };
  };

  const panel: PanelView = treasure
    ? { kind: "progress", progress: treasureProgress(treasure) }
    : stack
      ? { kind: "progress", progress: stackProgress(stack) }
      : { kind: "details", details, reserve: TICKETS.filter((ticket) => ticket.id !== def.id).map(detailsOf) };

  const stage: Stage = board
    ? {
        kind: "ticket",
        counter: stack && stack.quantity > 1 ? t("scratch.counter", { n: index + 1, total: stack.quantity }) : null,
        runningTotal: stack && stack.quantity > 1 ? t("scratch.runningTotal", { amount: kpText(wonSoFar) }) : null,
        summary,
        result,
        finished,
        ticket: {
          look,
          brand: t("nav.kanicasino"),
          series: t("scratch.series", { n: look.series }),
          name,
          price: kpText(def.price),
          rules: ticketRules,
          key: keyRows(def),
          serial: t("scratch.serial", { serial: serialOf(serialId) }),
          code: codeOf(serialId),
          verify: rollId ? () => navigate(`/provably-fair?roll=${rollId}`) : null,
          board,
        },
      }
    : { kind: "catalogue", brand: t("nav.kanicasino"), selectedLabel: t("scratch.selected"), cards, select: selectTicket };

  return {
    isLogged,
    stageRef,
    panel,
    quantities: quantitiesOf(def),
    quantity,
    chooseQuantity,
    // a ticket sold one at a time keeps the row's place, so picking it in the rack moves nothing under the panel
    quantityRow: panel.kind !== "details" ? null : def.kind === "pick" ? ("held" as const) : ("shown" as const),
    canChoose,
    total,
    action,
    showRevealStack,
    holdRevealStack: !!stack && stack.quantity > 1 && !showRevealStack,
    revealStack,
    stage,
    bigWin,
  };
};
