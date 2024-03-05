import { useState, useEffect, useRef } from "react";
import Rarities from "./Rarities";
import { BasicItem } from "./Types";

interface Roulette {
  items: BasicItem[];
  openedItem: BasicItem;
  spin: boolean;
  className?: string;
  direction?: "horizontal" | "vertical";
}

const Roulette: React.FC<Roulette> = ({ items, openedItem, spin, className, direction = "horizontal" }) => {
  const [rouletteItems, setRouletteItems] = useState<BasicItem[]>([]);
  const [translateValue, setTranslateValue] = useState<string>("-6180px");
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

      if (currentIndex === winningPosition) {
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

  useEffect(() => {
    if (spin) {
      // Generate a random translateX value between -6090px and -6240px
      const randomTranslateX = (direction == "vertical" ? -6042 : -6090 - Math.floor(Math.random() * 151));
      setTranslateValue(`${randomTranslateX}px`);
    }
  }, [spin]);

  useEffect(() => {
    if (rouletteRef.current && spin) {
      rouletteRef.current.style.animation =
        `spin 7.1s cubic-bezier(0.1, 0, 0.2, 1)`;
    } else if (rouletteRef.current) {
      rouletteRef.current.style.animation = "";
    }
  }, [spin, translateValue]);

  return (
    <div className={`flex  ${direction == "vertical" ? "max-h-[1100px]" : "max-w-[1100px]"} overflow-hidden ${className}`}>
      <div className={`flex items-center gap-2  ${direction == "vertical" ? "flex-col" : "flex-row"}`} ref={rouletteRef}>
        {rouletteItems.map((item: BasicItem, index: number) => (
          <div
            key={index}
            className={`flex-shrink-0 relative ${direction == "vertical" ? "h-32 aspect-square" : "w-[176px] h-[176px]"}`}
            style={{
              borderBottom: Rarities.find((rarity) => rarity.id == item.rarity)?.color + " solid 4px",
            }}
          >
            <img
              src={item && item.image}
              alt={item && item.name}
              className={`object-cover w-full h-full`}
            />
          </div>
        ))}
        <style>{`
          @keyframes spin {
            from {
              transform: ${direction == "vertical" ? "translateY(0%);" : "translateX(0%);"};
            }
            to {
              transform: ${direction == "vertical" ? `translateY(${translateValue});` : `translateX(${translateValue});`};
            }
          }
        `}</style>
      </div>
      <div className={`absolute  ${direction == "vertical" ? "top-0 inset-x-0" : "left-0 inset-y-0 bg-gradient-to-r"} w-24 h-full  from-[#151225] via-transparent`} />
      <div className={`absolute  ${direction == "vertical" ? "bottom-0 inset-x-0 " : "right-0 inset-y-0 bg-gradient-to-l"} w-24 h-full  from-[#151225] via-transparent`} />
    </div>
  );
};

export default Roulette;





