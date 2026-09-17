import { useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import UserContext from "../../../UserContext";
import TourBubble from "./TourBubble";
import { useTarget } from "./useTarget";
import { GamePicker, Guided, PlayStep, Spotlight } from "./tourParts";
import { GAME_RESULT_EVENT, GameResult, ITEM_PINNED_EVENT, ITEM_SOLD_EVENT, openChat, openDaisuShop, showDaisu } from "./tourEvents";
import { endHelp, helpTo, useHelp } from "./helpStore";
import { useTour } from "./tourStore";
import { tourGame } from "./tourGames";
import { Wizard, wizardFor } from "./helpWizards";
import { usePotStatus } from "../potStore";
import { useLocked } from "../shop/useLocked";
import { GAME_NAME_KEYS, GAME_PATHS } from "../potMath";
import type { PotStatus } from "../../../services/daisu/DaisuService";
import i18n from "../../../i18n";

// a beat to see how the round landed before she lets go
const RESULT_BEAT_MS = 1200;
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.help.${key}`, vars);
const gotIt = () => ({ label: i18n.t("daisu.roadmap.gotIt"), onClick: endHelp });
const isPhone = () => window.innerWidth < 768;

interface Place {
  go: string;
  here: (pathname: string, search: string) => boolean;
}

const at = (go: string, here: Place["here"] = (pathname) => pathname === go): Place => ({ go, here });
// the profile swaps an id in its address for the account's canonical one
const onProfile = (pathname: string) => pathname.startsWith("/profile/");

// where a step happens. her card follows the player anywhere, so the steps about it have no place
const placeOf = (wizard: Wizard, step: string, userId: string, gamePath: string | null): Place | null => {
  switch (wizard) {
    case "pin":
    case "sell":
      return at(`/profile/${userId}`, onProfile);
    case "collection":
      return at(`/profile/${userId}?tab=collections`, (pathname, search) => onProfile(pathname) && search.includes("tab=collections"));
    case "affiliates":
      return at(`/profile/${userId}?tab=affiliates`, (pathname, search) => onProfile(pathname) && search.includes("tab=affiliates"));
    case "gift":
      return at("/gift");
    case "market":
      return at("/marketplace");
    case "cases":
      return at("/");
    case "battle":
      return at("/battles");
    case "fans":
      return at("/fandom");
    case "predictions":
      return at("/predictions", (pathname) => pathname.startsWith("/predictions"));
    default:
      return gamePath && step !== "take" && step !== "pick" ? at(gamePath) : null;
  }
};

const expiry = (at: string | null) => (at ? Date.parse(at) : 0);

// the freshest bonus still running, which is the one a bet would spend
const liveBonus = (status: PotStatus | null, now = Date.now()) =>
  (status?.bonuses || [])
    .filter((b) => !b.expired && b.amount > 0 && (!b.expiresAt || expiry(b.expiresAt) > now))
    .sort((a, b) => expiry(b.expiresAt) - expiry(a.expiresAt))[0] || null;

interface StepProps {
  eyebrow: string;
  stop: string;
}

// the player's own items: she outlines the first one, waits for whichever they choose, then says so.
// she sits above the row, so the items to choose from stay in view
const ItemStep = ({ eyebrow, stop, verb, done }: StepProps & { verb: "pin" | "sell"; done: boolean }) => {
  const item = useTarget(verb === "pin" ? "item-pin" : "item-card");
  const empty = useTarget("inventory-empty");
  if (empty.present && !done) return <TourBubble rect={null} eyebrow={eyebrow} line={t(`${verb}.empty`)} next={gotIt()} />;
  const says = done
    ? { line: t(`${verb}.done`), next: gotIt() }
    : { line: t(`${verb}.${isPhone() ? "linePhone" : "line"}`), wait: t(`${verb}.wait`), endLabel: stop, onEnd: endHelp };
  return (
    <>
      <Spotlight rect={done ? null : item.rect} dim={false} />
      <TourBubble rect={item.rect} eyebrow={eyebrow} prefer="above" {...says} />
    </>
  );
};

// the market's first item, or the button to sell one while nothing is listed
const MarketStep = ({ eyebrow }: { eyebrow: string }) => {
  const item = useTarget("market-item");
  const sell = useTarget("market-sell");
  const target = item.present ? item : sell;
  return (
    <>
      <Spotlight rect={target.rect} />
      <TourBubble rect={target.rect} eyebrow={eyebrow} line={t("market.line")} next={gotIt()} />
    </>
  );
};

// the gift page is one of three things: collections to pick from, a spin to press, or a timer
const GiftStep = ({ eyebrow, stop }: StepProps) => {
  const later = useTarget("gift-next");
  const spin = useTarget("gift-spin");
  const pick = useTarget("gift-pick");
  if (later.present) {
    return (
      <>
        <Spotlight rect={later.rect} />
        <TourBubble rect={later.rect} eyebrow={eyebrow} line={t("gift.later")} next={gotIt()} />
      </>
    );
  }
  const target = spin.present ? spin : pick;
  return (
    <>
      <Spotlight rect={target.rect} dim={spin.present} />
      <TourBubble
        rect={target.rect}
        eyebrow={eyebrow}
        line={t(spin.present ? "gift.spin" : "gift.pick")}
        wait={t("gift.wait")}
        endLabel={stop}
        onEnd={endHelp}
        prefer={spin.present ? undefined : "above"}
      />
    </>
  );
};

// daisu showing how one of her missions is done: she goes where it happens, points at the thing and
// waits for the player to do it. every step can stop her, and walking off the page does too
const HelpOverlay = () => {
  const { userData } = useContext(UserContext);
  const userId: string | null = userData?.features?.daisu ? userData.id : null;
  const help = useHelp();
  const tour = useTour();
  const status = usePotStatus();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const arrived = useRef<string | null>(null);
  const bookLocked = useLocked("collectionBook");
  const licenseLocked = useLocked("tradersLicense");

  const wizard = userId && help.owner === userId ? wizardFor(help.goal) : null;
  const step = wizard ? help.step : null;
  const game = tourGame(help.game);
  const touring = !!userId && tour.owner === userId && (tour.status === "offered" || tour.status === "active");
  const place = wizard && step && userId ? placeOf(wizard, step, userId, game ? game.path : null) : null;
  const inRound = !!game && (step === "strip" || step === "bet" || step === "play");

  // her first move: off to where the mission happens, or her card when it is about the jar
  useEffect(() => {
    if (!wizard || step || touring || !userId) return;
    arrived.current = null;
    // a page that needs an item from her shop first starts at the shop, on that item
    if ((wizard === "collection" && bookLocked) || (wizard === "market" && licenseLocked)) {
      endHelp();
      openDaisuShop(wizard === "collection" ? "collectionBook" : "tradersLicense");
      return;
    }
    if (wizard === "games") {
      helpTo("pick");
      return;
    }
    if (wizard === "bonus") {
      const bonus = liveBonus(status);
      if (bonus) {
        helpTo("strip", { game: bonus.game });
        navigate(GAME_PATHS[bonus.game]);
      } else {
        helpTo("take");
        showDaisu("popup");
      }
      return;
    }
    helpTo(wizard);
    if (wizard === "pot") {
      showDaisu("popup");
      return;
    }
    if (wizard === "chat") {
      openChat();
      return;
    }
    const first = placeOf(wizard, wizard, userId, null);
    if (first) navigate(first.go);
  }, [wizard, step, touring, userId, status, navigate, bookLocked, licenseLocked]);

  // a take puts a bonus on a game, and that game is where she shows it
  useEffect(() => {
    if (step !== "take") return;
    const bonus = liveBonus(status);
    if (!bonus) return;
    showDaisu("bubble");
    helpTo("strip", { game: bonus.game });
    navigate(GAME_PATHS[bonus.game]);
  }, [step, status, navigate]);

  // the jar holds still while she points at it
  useEffect(() => {
    if (step !== "pot" && step !== "take") return;
    document.body.classList.add("daisu-still");
    return () => document.body.classList.remove("daisu-still");
  }, [step]);

  // once the player has reached the page a step is about, walking off it ends the help
  useEffect(() => {
    if (!place) return;
    if (place.here(pathname, search)) arrived.current = place.go;
    else if (arrived.current === place.go) endHelp();
  }, [place, pathname, search]);

  useEffect(() => {
    if (step !== "pin" && step !== "sell") return;
    const event = step === "pin" ? ITEM_PINNED_EVENT : ITEM_SOLD_EVENT;
    const onDone = () => helpTo(step === "pin" ? "pinned" : "sold");
    window.addEventListener(event, onDone);
    return () => window.removeEventListener(event, onDone);
  }, [step]);

  // the hearts only show under a cursor, and a phone has none, so while she waits they all show
  useEffect(() => {
    if (step !== "pin") return;
    document.body.classList.add("daisu-help-pin");
    return () => document.body.classList.remove("daisu-help-pin");
  }, [step]);

  // opening a collection is what the mission asks for
  useEffect(() => {
    if (step === "collection" && new URLSearchParams(search).has("case")) endHelp();
  }, [step, search]);

  useEffect(() => {
    if (step !== "gift") return;
    const onClick = (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest("button") : null;
      if (button && !button.disabled && button.closest('[data-tour="gift-spin"]')) endHelp();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step]);

  useEffect(() => {
    if (!inRound || !game) return;
    let timer = 0;
    const onResult = (e: Event) => {
      const result = (e as CustomEvent<GameResult>).detail;
      if (timer || !result || result.game !== game.key) return;
      timer = window.setTimeout(endHelp, RESULT_BEAT_MS);
    };
    window.addEventListener(GAME_RESULT_EVENT, onResult);
    return () => {
      window.removeEventListener(GAME_RESULT_EVENT, onResult);
      window.clearTimeout(timer);
    };
  }, [inRound, game]);

  if (!wizard || !step || touring || pathname.startsWith("/link/")) return null;

  const eyebrow = t("eyebrow", { mission: help.title });
  const stop = t("stop");
  const next = (to: string) => ({ label: i18n.t("daisu.tour.next"), onClick: () => helpTo(to) });

  let content: JSX.Element | null = null;
  if (step === "pot") {
    content = <Guided target="daisu-jar" anchor="daisu-card" eyebrow={eyebrow} line={t("pot.line")} next={gotIt()} />;
  } else if (step === "pin" || step === "sell") {
    content = <ItemStep verb={step} done={false} eyebrow={eyebrow} stop={stop} />;
  } else if (step === "pinned" || step === "sold") {
    content = <ItemStep verb={step === "pinned" ? "pin" : "sell"} done eyebrow={eyebrow} stop={stop} />;
  } else if (step === "take" && status) {
    content = (
      <Guided
        target="daisu-jar"
        anchor="daisu-card"
        eyebrow={eyebrow}
        line={t("bonus.take", { game: i18n.t(GAME_NAME_KEYS[status.pick]) })}
        wait={t("bonus.takeWait")}
        endLabel={stop}
        onEnd={endHelp}
      />
    );
  } else if (step === "strip") {
    content = <Guided target="game-bonus" eyebrow={eyebrow} line={t("bonus.strip")} next={next("play")} endLabel={stop} onEnd={endHelp} />;
  } else if (step === "pick") {
    content = (
      <GamePicker
        eyebrow={eyebrow}
        line={t("games.line")}
        endLabel={stop}
        onPick={(g) => {
          helpTo("bet", { game: g.key });
          navigate(g.path);
        }}
        onEnd={endHelp}
      />
    );
  } else if (step === "bet" && game) {
    content = (
      <Guided
        target="bet-input"
        eyebrow={eyebrow}
        line={i18n.t(`daisu.tour.bet.${game.key}`)}
        next={next("play")}
        endLabel={stop}
        onEnd={endHelp}
      />
    );
  } else if (step === "play" && game) {
    content = (
      <PlayStep
        eyebrow={eyebrow}
        line={wizard === "bonus" ? t("bonus.play") : i18n.t("daisu.tour.playLine")}
        endLabel={stop}
        onEnd={endHelp}
      />
    );
  } else if (step === "gift") {
    content = <GiftStep eyebrow={eyebrow} stop={stop} />;
  } else if (step === "market") {
    content = <MarketStep eyebrow={eyebrow} />;
  } else if (step === "collection" && help.goal === "collectionsCompleted") {
    content = <Guided target="collection-card" eyebrow={eyebrow} line={t("collection.complete")} next={gotIt()} />;
  } else if (step === "collection") {
    content = (
      <Guided target="collection-card" eyebrow={eyebrow} line={t("collection.line")} wait={t("collection.wait")} endLabel={stop} onEnd={endHelp} />
    );
  } else if (step === "cases") {
    content = (
      <Guided
        target={isPhone() ? "case-card" : "case-shelf"}
        eyebrow={eyebrow}
        line={t("cases.line")}
        wait={i18n.t("daisu.tour.caseWait")}
        endLabel={stop}
        onEnd={endHelp}
      />
    );
  } else if (step === "battle") {
    content = <Guided target="battle-create" dim={false} eyebrow={eyebrow} line={t("battle.line")} next={gotIt()} />;
  } else if (step === "fans") {
    content = <Guided target="fandom-reach" dim={false} eyebrow={eyebrow} line={t("fans.line")} next={gotIt()} />;
  } else if (step === "affiliates") {
    content = <Guided target="affiliates-code" dim={false} eyebrow={eyebrow} line={t("affiliates.line")} next={gotIt()} />;
  } else if (step === "predictions") {
    content = <Guided target="predictions-list" dim={false} eyebrow={eyebrow} line={t("predictions.line")} next={gotIt()} />;
  } else if (step === "chat") {
    content = <Guided target="chat-input" eyebrow={eyebrow} line={t("chat.line")} next={gotIt()} />;
  }

  if (!content) return null;
  // the portal sits outside the app's wrapper, so it sets its own text colour
  return createPortal(<div className="pointer-events-none fixed inset-0 z-[150] text-white">{content}</div>, document.body);
};

export default HelpOverlay;
