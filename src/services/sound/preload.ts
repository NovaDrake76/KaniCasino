import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sound } from "./sound";
import type { SoundEvent } from "./events";

const GAME: SoundEvent[] = ["game.bet", "game.cashout", "game.win", "game.lose"];
const CARDS: SoundEvent[] = ["cards.deal", "cards.flip", "cards.shuffle"];
const REEL: SoundEvent[] = ["case.tick", "case.stop"];

// what a page will need, decoded on arrival so its first play is not dropped while the file loads
export const SOUND_PAGES: [string, SoundEvent[]][] = [
  ["/case/", ["case.open", ...REEL, "case.reveal.common", "case.reveal.rare", "case.reveal.epic", "case.reveal.legendary"]],
  ["/coinflip", [...GAME, "coin.flip", "coin.land"]],
  ["/crash", [...GAME, "crash.start", "crash.tick", "crash.cashout", "crash.crash"]],
  ["/upgrade", [...REEL, "upgrade.start", "upgrade.success", "upgrade.fail"]],
  ["/slot", [...GAME, "slots.spin", "slots.stop", "slots.win"]],
  ["/plinko", [...GAME, "plinko.drop", "plinko.peg", "plinko.land.low", "plinko.land.mid", "plinko.land.high"]],
  ["/blackjack", [...GAME, ...CARDS, "bj.push", "bj.blackjack"]],
  ["/dice", [...GAME, "dice.roll", "dice.land"]],
  ["/mines", [...GAME, "mines.reveal", "mines.bomb"]],
  ["/hilo", [...GAME, ...CARDS, "hilo.correct", "hilo.wrong"]],
  ["/battles/", [...REEL, "battle.start", "battle.win", "battle.lose"]],
  ["/gift", ["game.bet", "gift.spin", "gift.stop", "gift.claim"]],
  ["/marketplace", ["ui.purchase"]],
];

export const eventsFor = (pathname: string): SoundEvent[] =>
  SOUND_PAGES.filter(([prefix]) => pathname.startsWith(prefix)).flatMap(([, events]) => events);

export const useSoundPreload = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    sound.preload(eventsFor(pathname));
  }, [pathname]);
};
