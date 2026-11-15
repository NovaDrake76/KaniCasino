import i18n from "../../../i18n";
import InfoTable from "./InfoTable";
import Paylines from "./Paylines";
import { SLOT_SYMBOLS, lineChance } from "../../../pages/Slot/symbols";
import { MAX_BET as DICE_MAX, MIN_BET as DICE_MIN, multiplierFor as diceMultiplier, OUTCOMES } from "../../../pages/Dice/diceControls";
import { MAX_BET as PLINKO_MAX, PAYOUT_MULTIPLIERS, RISKS, ROWS, binChance, formatChance } from "../../../pages/Plinko/plinkoBoard";
import { MAX_BET as MINES_MAX, MAX_PAYOUT as MINES_CAP, MIN_BET as MINES_MIN, gemsFor, multiplierFor as minesMultiplier } from "../../../pages/Mines/minesGrid";
import { MAX_BET as HILO_MAX, MAX_SKIPS, MIN_BET as HILO_MIN, RANKS, hiChance, loChance } from "../../../pages/Hilo/hiloCards";
import {
  RTP as SCRATCH_RTP,
  TICKETS as SCRATCH_TICKETS,
  ninePays,
  oneIn,
  payoutSplit,
  symbolSrc,
  topPrize as scratchTopPrize,
  winOdds as scratchWinOdds,
  type PickTicket,
  type Ticket as ScratchTicket,
} from "../../../pages/Scratch/scratchTickets";
import {
  CAP as LOTTERY_CAP,
  FIXED_RTP as LOTTERY_FIXED_RTP,
  JACKPOT_BASE,
  JACKPOT_SHARE,
  POINTS_PER_KP as LOTTERY_POINTS,
  PRICE as LOTTERY_PRICE,
  PRIZES as LOTTERY_PRIZES,
  localDrawTime,
  oneIn as lotteryOneIn,
} from "../../../pages/Lottery/lotteryRules";
import { ALL_RARITIES, UPGRADE_CEILING, UPGRADE_RTP_BY_RARITY } from "../../../pages/Upgrade/upgradeRules";
import { MODES, MODE_SLOTS } from "../../../services/battles/BattleService";

export type GameKey = "crash" | "coinflip" | "slots" | "upgrade" | "battles" | "plinko" | "blackjack" | "dice" | "mines" | "hilo" | "scratch" | "lottery";

// what a live page knows that the info cannot: the coin's current sides and what they pay
export interface InfoContext {
  purpleOn?: boolean;
  side?: number;
  purple?: number;
  purpleChance?: number;
}

export interface InfoSection {
  title: string;
  steps?: string[];
  paragraphs?: string[];
  node?: React.ReactNode;
  bullets?: string[];
}

export interface GameInfoContent {
  name: string;
  summary: string;
  chips: string[];
  sections: InfoSection[];
  facts: { label: string; value: string; gold?: boolean }[];
  fairness: string;
  // whether the provably fair page can open and check this game's rounds
  verifiable: boolean;
}

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const g = (game: GameKey, key: string, options?: Record<string, unknown>) => t(`gameInfo.${game}.${key}`, options);
const num = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: digits });
const kp = (n: number) => `K₽${num(n, 0)}`;
const pct = (n: number, digits = 2) => `${num(n * 100, digits)}%`;
const times = (n: number) => `${num(n)}x`;
const span = (min: string, max: string) => t("gameInfo.facts.range", { min, max });
const range = (min: number, max: number) => span(kp(min), kp(max));
const points = (n: number) => t("gameInfo.facts.perKp", { points: num(n) });
const notes = (game: GameKey, count: number, options?: Record<string, unknown>) =>
  Array.from({ length: count }, (_, i) => g(game, `note${i + 1}`, options));
// the game's own button labels, so the text names what the player sees
const crashLabels = () => ({ cashoutAt: t("crash.cashoutAt"), cashOut: t("common.cashOut") });
const sideNames = () => ({ heads: t("coin.heads"), tails: t("coin.tails"), purpleName: t("coin.purple") });
const steps = (game: GameKey, options?: Record<string, unknown>) => [1, 2, 3].map((i) => g(game, `step${i}`, options));

const fact = (label: string, value: string, gold = false) => ({ label: t(`gameInfo.facts.${label}`), value, gold });
const rtpChip = (rtp: number) => t("gameInfo.chips.rtp", { rtp: num(rtp * 100) });
const fairChip = () => t("gameInfo.chips.fair");

const howToPlay = (game: GameKey, options?: Record<string, unknown>): InfoSection => ({
  title: t("gameInfo.sections.howToPlay"),
  steps: steps(game, options),
});
const goodToKnow = (game: GameKey, count: number, options?: Record<string, unknown>): InfoSection => ({
  title: t("gameInfo.sections.goodToKnow"),
  bullets: notes(game, count, options),
});

// crash: auto cash out at x is paid with probability 96.03% / x (3% instant busts, then 99/(100x - 1) per hundredth)
const CRASH_RTP = 0.9603;
const crash = (): GameInfoContent => ({
  name: t("nav.crash"),
  summary: g("crash", "summary"),
  chips: [rtpChip(CRASH_RTP), fairChip()],
  sections: [
    howToPlay("crash", crashLabels()),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("crash", "payouts", crashLabels())],
      node: (
        <InfoTable
          head={[t("gameInfo.table.cashoutAt"), t("gameInfo.table.chance")]}
          rows={[1.5, 2, 3, 5, 10, 100, 1000].map((x) => [times(x), formatChance(CRASH_RTP / x)])}
        />
      ),
    },
    goodToKnow("crash", 4, crashLabels()),
  ],
  facts: [
    fact("rtp", pct(CRASH_RTP)),
    fact("edge", pct(1 - CRASH_RTP)),
    fact("bet", range(1, 1000000)),
    fact("maxWin", t("gameInfo.facts.noCap"), true),
    fact("points", points(1.3)),
  ],
  fairness: g("crash", "fair"),
  verifiable: false,
});

const coinflip = (ctx: InfoContext = {}): GameInfoContent => {
  const purpleOn = !!ctx.purpleOn;
  const side = ctx.side || (purpleOn ? 2 : 1.94);
  const purple = ctx.purple || 32;
  const purpleChance = purpleOn ? ctx.purpleChance || 3 : 0;
  const sideChance = (100 - purpleChance) / 2;
  const sideRtp = (sideChance / 100) * side;
  const purpleRtp = (purpleChance / 100) * purple;
  return {
    name: t("nav.coinFlip"),
    summary: g("coinflip", "summary"),
    chips: [rtpChip(sideRtp), fairChip()],
    sections: [
      howToPlay("coinflip"),
      {
        title: t("gameInfo.sections.payouts"),
        paragraphs: [
          purpleOn
            ? g("coinflip", "payouts", { ...sideNames(), sideChance: num(sideChance), side: num(side), purpleChance: num(purpleChance), purple: num(purple) })
            : g("coinflip", "payoutsPlain", { ...sideNames(), side: num(side) }),
        ],
        node: (
          <InfoTable
            head={[t("gameInfo.table.side"), t("gameInfo.table.chance"), t("gameInfo.table.pays")]}
            plain={[1]}
            rows={[
              [t("coin.heads"), `${num(sideChance)}%`, times(side)],
              [t("coin.tails"), `${num(sideChance)}%`, times(side)],
              ...(purpleOn ? [[t("coin.purple"), `${num(purpleChance)}%`, times(purple)]] : []),
            ]}
          />
        ),
      },
      goodToKnow("coinflip", 4),
    ],
    facts: [
      ...(purpleOn
        ? [
            { label: t("gameInfo.facts.rtpSides", sideNames()), value: pct(sideRtp) },
            { label: t("gameInfo.facts.rtpPurple", sideNames()), value: pct(purpleRtp) },
          ]
        : [fact("rtp", pct(sideRtp)), fact("edge", pct(1 - sideRtp))]),
      fact("bet", range(10, 1000000)),
      fact("maxWin", t("gameInfo.facts.noCap"), true),
      fact("points", points(1)),
    ],
    fairness: g("coinflip", "fair"),
    verifiable: false,
  };
};

// slots: each line returns this much per K₽ bet, and the five lines add up
const SLOTS_RTP = 5 * SLOT_SYMBOLS.reduce((sum, s) => sum + lineChance(s.key) * s.pays, 0);
const slots = (): GameInfoContent => ({
  name: t("nav.slots"),
  summary: g("slots", "summary"),
  chips: [rtpChip(SLOTS_RTP), fairChip()],
  sections: [
    howToPlay("slots"),
    { title: t("gameInfo.sections.paylines"), node: <Paylines /> },
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("slots", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.symbol"), t("gameInfo.table.threeInLine"), t("gameInfo.table.perLine")]}
          plain={[2]}
          rows={SLOT_SYMBOLS.map((s) => [
            <span key={s.key} className="flex items-center gap-3 font-semibold text-ink">
              <img src={s.image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
              {t(`gameInfo.symbols.${s.key}`)}
            </span>,
            times(s.pays),
            t("gameInfo.table.oneIn", { n: num(Math.round(1 / lineChance(s.key)), 0) }),
          ])}
        />
      ),
    },
    goodToKnow("slots", 2),
  ],
  facts: [
    fact("rtp", pct(SLOTS_RTP)),
    fact("edge", pct(1 - SLOTS_RTP)),
    fact("bet", range(1, 50000)),
    fact("maxWin", times(500), true),
    fact("points", points(1.15)),
  ],
  fairness: g("slots", "fair"),
  verifiable: true,
});

const upgrade = (): GameInfoContent => {
  const returns = ALL_RARITIES.map((r) => UPGRADE_RTP_BY_RARITY[String(r)]);
  return {
    name: t("nav.upgrade"),
    summary: g("upgrade", "summary"),
    chips: [fairChip(), t("gameInfo.chips.items")],
    sections: [
      howToPlay("upgrade"),
      {
        title: t("gameInfo.sections.payouts"),
        paragraphs: [g("upgrade", "payouts")],
        node: (
          <InfoTable
            head={[t("gameInfo.table.targetRarity"), t("gameInfo.table.return"), t("gameInfo.table.maxChance")]}
            plain={[1]}
            rows={ALL_RARITIES.map((r) => [t(`rarity.${r}`), pct(UPGRADE_RTP_BY_RARITY[String(r)], 0), pct(UPGRADE_CEILING[String(r)], 0)])}
          />
        ),
      },
      goodToKnow("upgrade", 3),
    ],
    facts: [
      fact("return", span(pct(Math.min(...returns), 0), pct(Math.max(...returns), 0))),
      fact("maxChance", pct(Math.max(...ALL_RARITIES.map((r) => UPGRADE_CEILING[String(r)])), 0), true),
      fact("points", t("gameInfo.facts.none")),
    ],
    fairness: g("upgrade", "fair"),
    verifiable: true,
  };
};

const battles = (): GameInfoContent => ({
  name: t("nav.caseBattles"),
  summary: g("battles", "summary"),
  chips: [fairChip()],
  sections: [
    howToPlay("battles"),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("battles", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.mode"), t("gameInfo.table.players")]}
          plain={[1]}
          rows={MODES.map((mode) => [mode, String(MODE_SLOTS[mode])])}
        />
      ),
    },
    goodToKnow("battles", 3),
  ],
  facts: [
    fact("entry", t("gameInfo.facts.entryValue")),
    fact("cases", span("1", "20")),
    fact("players", span("2", "4")),
    fact("points", points(1.5)),
  ],
  fairness: g("battles", "fair"),
  verifiable: false,
});

// plinko: every peg is a coin toss, so a risk's return is its multipliers weighted by the binomial
const plinkoRtp = (risk: (typeof RISKS)[number]) =>
  PAYOUT_MULTIPLIERS[risk].reduce((sum, m, bin) => sum + m * binChance(bin), 0);
const plinko = (): GameInfoContent => {
  const rtps = RISKS.map(plinkoRtp);
  const middle = ROWS / 2;
  const fromCenter = Array.from({ length: middle + 1 }, (_, d) => d);
  return {
    name: t("nav.plinko"),
    summary: g("plinko", "summary"),
    chips: [rtpChip(Math.min(...rtps)), fairChip()],
    sections: [
      howToPlay("plinko"),
      {
        title: t("gameInfo.sections.payouts"),
        paragraphs: [g("plinko", "payouts")],
        node: (
          <InfoTable
            head={[t("gameInfo.table.slot"), t("gameInfo.table.chance"), ...RISKS.map((r) => t(`gameInfo.plinko.${r}`))]}
            plain={[1]}
            rows={[
              ...fromCenter.map((d) => [
                d === 0 ? t("gameInfo.table.center") : d === middle ? t("gameInfo.table.edge") : t("gameInfo.table.fromCenter", { n: d }),
                formatChance(binChance(middle - d)),
                ...RISKS.map((r) => times(PAYOUT_MULTIPLIERS[r][middle - d])),
              ]),
              [t("gameInfo.table.return"), "", ...rtps.map((rtp) => pct(rtp))],
            ]}
          />
        ),
      },
      {
        title: t("gameInfo.sections.goodToKnow"),
        bullets: [
          g("plinko", "note1", { low: kp(PLINKO_MAX.low), medium: kp(PLINKO_MAX.medium), high: kp(PLINKO_MAX.high) }),
          g("plinko", "note2"),
        ],
      },
    ],
    facts: [
      fact("rtp", span(pct(Math.min(...rtps)), pct(Math.max(...rtps)))),
      fact("bet", range(1, Math.max(...Object.values(PLINKO_MAX)))),
      fact("maxWin", kp(1000000), true),
      fact("points", points(1.15)),
    ],
    fairness: g("plinko", "fair"),
    verifiable: true,
  };
};

const blackjack = (): GameInfoContent => ({
  name: t("blackjack.blackjack"),
  summary: g("blackjack", "summary"),
  chips: [rtpChip(0.994), fairChip()],
  sections: [
    howToPlay("blackjack"),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("blackjack", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.outcome"), t("gameInfo.table.pays")]}
          rows={[
            [g("blackjack", "outWin"), g("blackjack", "pays11")],
            [g("blackjack", "outBlackjack"), g("blackjack", "pays32")],
            [g("blackjack", "outInsurance"), g("blackjack", "pays21")],
            [g("blackjack", "outPush"), g("blackjack", "paysBack")],
          ]}
        />
      ),
    },
    goodToKnow("blackjack", 5),
  ],
  facts: [
    fact("rtp", g("blackjack", "rtp")),
    fact("bet", range(1, 100000)),
    fact("maxWin", t("gameInfo.facts.noCap"), true),
    fact("points", points(0.4)),
  ],
  fairness: g("blackjack", "fair"),
  verifiable: true,
});

const dice = (): GameInfoContent => ({
  name: t("dice.dice"),
  summary: g("dice", "summary"),
  chips: [rtpChip(0.99), fairChip()],
  sections: [
    howToPlay("dice"),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("dice", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.winChance"), t("gameInfo.table.multiplier")]}
          rows={[98, 75, 49.5, 33, 24.75, 10, 2].map((chance) => [`${num(chance)}%`, `${num(diceMultiplier((chance / 100) * OUTCOMES), 4)}x`])}
        />
      ),
    },
    goodToKnow("dice", 3),
  ],
  facts: [
    fact("rtp", "99%"),
    fact("edge", "1%"),
    fact("bet", range(DICE_MIN, DICE_MAX)),
    fact("maxWin", kp(DICE_MAX * diceMultiplier(200)), true),
    fact("points", points(0.4)),
  ],
  fairness: g("dice", "fair"),
  verifiable: true,
});

const MINE_ROWS = [1, 3, 5, 10, 20, 24];
const GEM_COLUMNS = [1, 2, 5, 10];
const mines = (): GameInfoContent => ({
  name: t("mines.mines"),
  summary: g("mines", "summary"),
  chips: [rtpChip(0.99), fairChip()],
  sections: [
    howToPlay("mines"),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("mines", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.minesGems"), ...GEM_COLUMNS.map(String)]}
          rows={MINE_ROWS.map((m) => [String(m), ...GEM_COLUMNS.map((n) => (n <= gemsFor(m) ? times(minesMultiplier(m, n)) : "-"))])}
        />
      ),
    },
    goodToKnow("mines", 4),
  ],
  facts: [
    fact("rtp", "99%"),
    fact("edge", "1%"),
    fact("bet", range(MINES_MIN, MINES_MAX)),
    fact("maxWin", kp(MINES_CAP), true),
    fact("points", points(0.4)),
  ],
  fairness: g("mines", "fair"),
  verifiable: true,
});

const CARD_NAMES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const hiloCell = (chance: number) => (
  <>
    <span className="font-normal text-ink-soft">{pct(chance)}</span> · {times(0.99 / chance)}
  </>
);
const hilo = (): GameInfoContent => ({
  name: t("hilo.hilo"),
  summary: g("hilo", "summary"),
  chips: [g("hilo", "chip"), fairChip()],
  sections: [
    howToPlay("hilo", { higher: t("hilo.higherOrEqual"), lower: t("hilo.lowerOrEqual") }),
    {
      title: t("gameInfo.sections.payouts"),
      paragraphs: [g("hilo", "payouts")],
      node: (
        <InfoTable
          head={[t("gameInfo.table.card"), t("hilo.higherOrEqual"), t("hilo.lowerOrEqual")]}
          rows={Array.from({ length: RANKS }, (_, rank) => [CARD_NAMES[rank], hiloCell(hiChance(rank)), hiloCell(loChance(rank))])}
        />
      ),
    },
    {
      title: t("gameInfo.sections.goodToKnow"),
      bullets: [g("hilo", "note1"), g("hilo", "note2", { skips: MAX_SKIPS }), g("hilo", "note3"), g("hilo", "note4")],
    },
  ],
  facts: [
    fact("edge", g("hilo", "edgeValue")),
    fact("bet", range(HILO_MIN, HILO_MAX)),
    fact("maxWin", kp(MINES_CAP), true),
    fact("points", points(0.4)),
  ],
  fairness: g("hilo", "fair"),
  verifiable: true,
});

// each ticket gets its own table: pocket by the symbol on the line, nine by what a ticket pays, treasure by its board
const scratchOdds = (slots: number, of?: number) => t("gameInfo.table.oneIn", { n: oneIn(slots, of) });
const scratchSymbol = (name: string) => (
  <img src={symbolSrc(name)} alt="" width={32} height={32} className="inline-block align-middle [image-rendering:pixelated]" />
);
// a board's finds, the repeats folded: K₽100,000 ×3 + K₽10,000
const scratchFinds = (finds: number[]) =>
  [...new Set(finds)].map((f) => {
    const n = finds.filter((x) => x === f).length;
    return n > 1 ? `${kp(f)} ×${n}` : kp(f);
  }).join(" + ");
const scratchRows = (ticket: ScratchTicket): React.ReactNode[][] => {
  if (ticket.kind === "line") {
    return [...ticket.prizes].reverse().map(([symbol, m, slots]) => [
      <span key={symbol} className="inline-flex items-center gap-2">{scratchSymbol(symbol)}×3</span>,
      kp(m * ticket.price),
      scratchOdds(slots),
    ]);
  }
  if (ticket.kind === "lucky") {
    const byPays = new Map<number, number>();
    for (const row of ticket.outcomes) byPays.set(ninePays(row), (byPays.get(ninePays(row)) || 0) + row[0]);
    return [...byPays.entries()].sort((a, b) => b[0] - a[0]).map(([pays, slots]) => [times(pays), kp(pays * ticket.price), scratchOdds(slots)]);
  }
  return [...ticket.boards].reverse().map(([slots, finds]) => [scratchFinds(finds), kp(finds.reduce((s, f) => s + f, 0)), scratchOdds(slots)]);
};
const scratchHead = (ticket: ScratchTicket) =>
  ticket.kind === "line"
    ? [g("scratch", "lineHead"), t("gameInfo.table.prize"), t("gameInfo.table.chance")]
    : ticket.kind === "lucky"
      ? [g("scratch", "paysHead"), t("gameInfo.table.prize"), t("gameInfo.table.chance")]
      : [g("scratch", "boardHead"), g("scratch", "boardTotal"), t("gameInfo.table.chance")];
const scratchChance = (n: number, of: number) => (
  <>
    {pct(n / of, 1)} · {scratchOdds(n, of)}
  </>
);
// a find under the price is still a loss, so treasure also shows what three spots pay against the price
const scratchSplit = (ticket: PickTicket) => {
  const split = payoutSplit(ticket);
  const of = split.reduce((s, n) => s + n, 0);
  const price = kp(ticket.price);
  const labels = ["splitNothing", "splitLess", "splitBack", "splitMore"].map((key) => g("scratch", key, { price }));
  return (
    <InfoTable
      head={[g("scratch", "splitHead"), t("gameInfo.table.chance")]}
      plain={[1]}
      rows={[
        ...split.map((n, i) => [labels[i], scratchChance(n, of)]),
        [g("scratch", "splitAtLeast", { price }), scratchChance(split[2] + split[3], of)],
      ]}
    />
  );
};
const scratchTicketSection = (ticket: ScratchTicket): InfoSection => {
  const [wins, of] = scratchWinOdds(ticket);
  return {
    title: `${t(`scratch.names.${ticket.id}`)} · ${kp(ticket.price)}`,
    paragraphs: [g("scratch", ticket.id)],
    node:
      ticket.kind === "pick" ? (
        <div className="flex flex-col gap-3">
          <InfoTable head={scratchHead(ticket)} plain={[2]} rows={scratchRows(ticket)} />
          {scratchSplit(ticket)}
        </div>
      ) : (
        <InfoTable head={scratchHead(ticket)} plain={[2]} rows={[...scratchRows(ticket), [g("scratch", "anyWin"), "", pct(wins / of)]]} />
      ),
  };
};
const scratch = (): GameInfoContent => {
  const prices = SCRATCH_TICKETS.map((ticket) => ticket.price);
  return {
    name: t("scratch.scratch"),
    summary: g("scratch", "summary"),
    chips: [rtpChip(SCRATCH_RTP), fairChip()],
    sections: [howToPlay("scratch"), ...SCRATCH_TICKETS.map(scratchTicketSection), goodToKnow("scratch", 3)],
    facts: [
      fact("rtp", pct(SCRATCH_RTP, 0)),
      fact("edge", pct(1 - SCRATCH_RTP, 0)),
      fact("bet", range(Math.min(...prices), Math.max(...prices))),
      fact("maxWin", kp(Math.max(...SCRATCH_TICKETS.map(scratchTopPrize))), true),
      fact("points", points(1.3)),
    ],
    fairness: g("scratch", "fair"),
    verifiable: true,
  };
};

// the draw time is shown on the viewer's clock; the odds are the share of the 1,140 possible draws
const lottery = (): GameInfoContent => {
  const time = localDrawTime(i18n.language);
  return {
    name: t("lottery.lottery"),
    summary: g("lottery", "summary", { time }),
    chips: [g("lottery", "chip"), fairChip()],
    sections: [
      howToPlay("lottery", { time, price: kp(LOTTERY_PRICE), cap: LOTTERY_CAP }),
      {
        title: t("gameInfo.sections.payouts"),
        paragraphs: [g("lottery", "payouts", { two: kp(LOTTERY_PRIZES[2]), rtp: pct(LOTTERY_FIXED_RTP), share: kp(JACKPOT_SHARE) })],
        node: (
          <InfoTable
            head={[g("lottery", "match"), t("gameInfo.table.prize"), t("gameInfo.table.chance")]}
            plain={[2]}
            rows={[3, 2, 1].map((k) => [
              g("lottery", "matchN", { n: k }),
              k === 3 ? g("lottery", "jackpotValue") : kp(LOTTERY_PRIZES[k]),
              t("gameInfo.table.oneIn", { n: lotteryOneIn(k) }),
            ])}
          />
        ),
      },
      {
        title: g("lottery", "jackpotTitle"),
        paragraphs: [g("lottery", "jackpot1", { base: kp(JACKPOT_BASE), share: kp(JACKPOT_SHARE) }), g("lottery", "jackpot2")],
      },
      goodToKnow("lottery", 4, { cap: LOTTERY_CAP, time }),
    ],
    facts: [
      fact("ticket", kp(LOTTERY_PRICE)),
      fact("jackpot", g("lottery", "fromValue", { amount: kp(JACKPOT_BASE) }), true),
      fact("drawTime", g("lottery", "dailyAt", { time })),
      fact("perDraw", String(LOTTERY_CAP)),
      fact("points", points(LOTTERY_POINTS)),
    ],
    fairness: g("lottery", "fair"),
    verifiable: false,
  };
};

export const gameInfo = (game: GameKey, ctx?: InfoContext): GameInfoContent => {
  switch (game) {
    case "crash":
      return crash();
    case "coinflip":
      return coinflip(ctx);
    case "slots":
      return slots();
    case "upgrade":
      return upgrade();
    case "battles":
      return battles();
    case "plinko":
      return plinko();
    case "blackjack":
      return blackjack();
    case "dice":
      return dice();
    case "mines":
      return mines();
    case "hilo":
      return hilo();
    case "scratch":
      return scratch();
    case "lottery":
      return lottery();
  }
};
