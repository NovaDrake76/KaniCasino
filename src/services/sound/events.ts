// every sound slot the site can play and how it is played; which file fills a slot lives in public/sounds/manifest.json

export const SOUND_EVENTS = [
  // ui
  "ui.click",
  "ui.confirm",
  "ui.error",
  "ui.open",
  "ui.close",
  "ui.toggle",
  "ui.notify",
  "ui.chat",
  "ui.purchase",
  "ui.bonus",
  "ui.levelup",
  "ui.rain",
  // daisu
  "daisu.jar",
  "daisu.poke",
  "daisu.take_sent",
  "daisu.take_failed",
  "daisu.empty",
  // generic game moments
  "game.bet",
  "game.cashout",
  "game.win",
  "game.bigwin",
  "game.lose",
  // dice
  "dice.roll",
  "dice.land",
  // coin flip
  "coin.flip",
  "coin.land",
  // crash
  "crash.start",
  "crash.tick",
  "crash.cashout",
  "crash.crash",
  // slots
  "slots.spin",
  "slots.stop",
  "slots.win",
  // cases / roulette
  "case.open",
  "case.tick",
  "case.stop",
  "case.reveal.common",
  "case.reveal.rare",
  "case.reveal.epic",
  "case.reveal.legendary",
  // mines
  "mines.reveal",
  "mines.bomb",
  // cards
  "cards.deal",
  "cards.flip",
  "cards.shuffle",
  "bj.push",
  "bj.blackjack",
  "hilo.correct",
  "hilo.wrong",
  // plinko
  "plinko.drop",
  "plinko.peg",
  "plinko.land.low",
  "plinko.land.mid",
  "plinko.land.high",
  // upgrade
  "upgrade.start",
  "upgrade.success",
  "upgrade.fail",
  // battles
  "battle.start",
  "battle.win",
  "battle.lose",
  // gift wheel
  "gift.spin",
  "gift.stop",
  "gift.claim",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

export interface SoundOptions {
  // 0..1, multiplied by the master volume
  volume?: number;
  // a pitch range picked from per play, so repeats do not sound like a machine gun; 1 is natural
  rate?: [number, number];
  // the same event will not play again within this many ms (0 = no limit)
  throttleMs?: number;
  // if true, a new play of this event stops the previous instance first
  solo?: boolean;
}

// rapid-fire events get a pitch spread and a throttle; jingles are solo so two wins in a row do not overlap
export const SOUND_DEFAULTS: Partial<Record<SoundEvent, SoundOptions>> = {
  "ui.click": { volume: 0.45, rate: [0.97, 1.03], throttleMs: 40 },
  "ui.toggle": { volume: 0.5, throttleMs: 40 },
  "ui.chat": { volume: 0.3, throttleMs: 400 },
  "ui.notify": { volume: 0.5, throttleMs: 300 },
  "ui.levelup": { volume: 0.7, solo: true },
  "daisu.jar": { volume: 0.55, rate: [0.9, 1.18], throttleMs: 25 },
  "daisu.poke": { volume: 0.5, rate: [0.95, 1.1], throttleMs: 60 },
  "daisu.take_sent": { volume: 0.6 },
  "game.bet": { volume: 0.6, rate: [0.95, 1.05], throttleMs: 60 },
  "game.win": { volume: 0.6, solo: true },
  "game.bigwin": { volume: 0.7, solo: true },
  "game.lose": { volume: 0.45, throttleMs: 80 },
  "dice.roll": { volume: 0.6, rate: [0.95, 1.05], throttleMs: 80 },
  "dice.land": { volume: 0.6, rate: [0.95, 1.08], throttleMs: 60 },
  "coin.land": { volume: 0.5, rate: [0.95, 1.05] },
  "crash.tick": { volume: 0.25, throttleMs: 90 },
  "crash.crash": { volume: 0.7, solo: true },
  "slots.spin": { volume: 0.35, rate: [0.95, 1.1], throttleMs: 70 },
  "slots.stop": { volume: 0.55, rate: [0.95, 1.05], throttleMs: 60 },
  "slots.win": { volume: 0.6, solo: true },
  "case.tick": { volume: 0.25, rate: [0.97, 1.05], throttleMs: 24 },
  "case.stop": { volume: 0.6 },
  "case.reveal.epic": { volume: 0.65, solo: true },
  "case.reveal.legendary": { volume: 0.75, solo: true },
  "mines.reveal": { volume: 0.55, rate: [0.95, 1.12], throttleMs: 40 },
  "mines.bomb": { volume: 0.75, solo: true },
  "cards.deal": { volume: 0.55, rate: [0.95, 1.08], throttleMs: 50 },
  "cards.flip": { volume: 0.55, rate: [0.95, 1.05], throttleMs: 50 },
  "plinko.drop": { volume: 0.5, throttleMs: 50 },
  "plinko.peg": { volume: 0.3, rate: [0.9, 1.15], throttleMs: 18 },
  "plinko.land.high": { volume: 0.7 },
  "gift.spin": { volume: 0.35, rate: [0.95, 1.1], throttleMs: 70 },
  "upgrade.success": { volume: 0.65, solo: true },
  "battle.win": { volume: 0.65, solo: true },
};
