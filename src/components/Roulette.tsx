import { useState, useEffect, useRef } from "react";
import Rarities from "./Rarities";
import { BasicItem } from "./Types";
import { play } from "../services/sound/sound";
import type { SoundEvent } from "../services/sound/events";

interface Roulette {
  items: BasicItem[];
  openedItem?: BasicItem;
  spin: boolean;
  className?: string;
  direction?: "horizontal" | "vertical";
  // optional per-item badge. the daily gift needs the prize size on the face of each
  // slot; cases and battles pass nothing and render exactly as before.
  overlay?: (item: BasicItem) => React.ReactNode;
  // the sound a slot makes as it passes the marker; without it the reel is silent
  tick?: SoundEvent;
}

const GAP = 8; // gap-2 between slots

const Roulette: React.FC<Roulette> = ({ items, openedItem, spin, className, direction = "horizontal", overlay, tick }) => {
  const [rouletteItems, setRouletteItems] = useState<BasicItem[]>([]);
  const [translateValue, setTranslateValue] = useState<string | null>(null);
  const rouletteRef = useRef<HTMLDivElement | null>(null);


  const shuffle = (array: BasicItem[]) => {
    const winningPosition = direction == "vertical" ? 48 : 36;
    let currentIndex = array.length,
      temporaryValue,
      randomIndex;

    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      if (
        (randomIndex === currentIndex - 1 && currentIndex !== 1) ||
        (randomIndex === currentIndex + 1 && currentIndex !== array.length)
      ) {
        continue;
      }
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;

      // without a winner the slot would stay empty and every read of it would throw
      if (currentIndex === winningPosition && openedItem) {
        array[currentIndex] = openedItem;
      }
    }

    return array;
  };

  useEffect(() => {
    const createRouletteItems = () => {
      let newItems = items.slice();
      while (newItems.length < 50) {
        newItems = newItems.concat(items.slice());
      }
      newItems = newItems.slice(0, 50);
      newItems = shuffle(newItems);
      setRouletteItems(newItems);
    };

    createRouletteItems();
  }, [items]);

  // how far to travel is a function of how big a slot is, and a slot is smaller on a
  // phone. hard-coding the distance sent the strip clean past its own end there and the
  // reel span blank, so it is measured off the rendered slot instead.
  useEffect(() => {
    if (!spin || !rouletteItems.length) return;
    const slot = rouletteRef.current?.firstElementChild as HTMLElement | null;
    const clip = rouletteRef.current?.parentElement;
    if (!slot || !clip) return;

    const size = direction == "vertical" ? slot.offsetHeight : slot.offsetWidth;
    // the window is 1100 wide only when the screen has room for it, so it is measured too:
    // aiming at the middle of an 1100 that was not there stopped a phone two slots early
    const view = direction == "vertical" ? clip.clientHeight : clip.clientWidth;
    if (!size || !view) return;
    const winning = direction == "vertical" ? 48 : 36;
    // put the middle of the winning slot on the middle of the window
    const centre = winning * (size + GAP) + size / 2 - view / 2;
    // the horizontal reel stops a little off centre so it never looks mechanical, but never
    // far enough for the winning slot to leave a narrow window
    const wobble = Math.max(0, Math.min(75, (view - size) / 2));
    const jitter = direction == "vertical" ? 0 : Math.round(Math.random() * 2 * wobble - wobble);
    setTranslateValue(`${-Math.round(centre + jitter)}px`);
  }, [spin, rouletteItems, direction]);

  useEffect(() => {
    if (rouletteRef.current && spin && translateValue) {
      rouletteRef.current.style.animation =
        `spin 7.1s cubic-bezier(0.1, 0, 0.2, 1)`;
    } else if (rouletteRef.current) {
      rouletteRef.current.style.animation = "";
    }
  }, [spin, translateValue]);

  // the tick reads the strip itself every frame and sounds the moment a slot crosses the marker, so it can never
  // drift from the animation the way a schedule of timers did; the pitch falls with how far the reel has come
  useEffect(() => {
    const strip = rouletteRef.current;
    const clip = strip?.parentElement;
    const slot = strip?.firstElementChild as HTMLElement | null;
    if (!tick || !spin || !translateValue || !strip || !clip || !slot) return;
    const vertical = direction == "vertical";
    const size = vertical ? slot.offsetHeight : slot.offsetWidth;
    const view = vertical ? clip.clientHeight : clip.clientWidth;
    const total = Math.abs(parseFloat(translateValue));
    if (!size || !view || !total) return;

    const pitch = size + GAP;
    const marker = view / 2;
    let last = Math.floor((marker - size / 2) / pitch);
    let frame = 0;
    const step = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
      const moved = Math.abs(vertical ? m.f : m.e);
      const crossed = Math.floor((moved + marker + GAP / 2) / pitch);
      if (crossed > last) {
        last = crossed;
        const rate = 0.92 - 0.17 * Math.min(1, moved / total);
        play(tick, { rate: [rate, rate] });
      }
      if (moved < total - 0.5) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [tick, spin, translateValue, direction]);

  return (
    <div className={`flex  ${direction == "vertical" ? "max-h-[1100px]" : "max-w-[1100px]"} overflow-hidden ${className}`}>
      <div className={`flex items-center gap-2  ${direction == "vertical" ? "flex-col" : "flex-row"}`} ref={rouletteRef}>
        {rouletteItems.map((item: BasicItem, index: number) => (
          <div
            key={index}
            className={`flex-shrink-0 relative ${direction == "vertical" ? "h-16 md:h-32 aspect-square" : "w-[176px] h-[176px]"}`}
            style={{
              borderBottom: Rarities.find((rarity) => rarity.id == item.rarity)?.color + " solid 4px",
            }}
          >
            <img
              src={item && item.image}
              alt={item && item.name}
              className={`object-cover w-full h-full`}
            />
            {overlay && overlay(item)}
          </div>
        ))}
        <style>{`
          @keyframes spin {
            from {
              transform: ${direction == "vertical" ? "translateY(0%);" : "translateX(0%);"};
            }
            to {
              transform: ${direction == "vertical" ? `translateY(${translateValue || "0px"});` : `translateX(${translateValue || "0px"});`};
            }
          }
        `}</style>
      </div>
      {/* the fade was sized for a horizontal reel either way, so on a vertical one it hung
          96px off the side of a 64px slot and had no gradient direction to fade along */}
      <div className={`absolute ${direction == "vertical" ? "top-0 inset-x-0 w-full h-12 bg-gradient-to-b" : "left-0 inset-y-0 w-24 h-full bg-gradient-to-r"} from-[#151225] via-transparent`} />
      <div className={`absolute ${direction == "vertical" ? "bottom-0 inset-x-0 w-full h-12 bg-gradient-to-t" : "right-0 inset-y-0 w-24 h-full bg-gradient-to-l"} from-[#151225] via-transparent`} />
    </div>
  );
};

export default Roulette;





