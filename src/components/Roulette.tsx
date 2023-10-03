import { useState, useEffect, useRef } from "react";
import Rarities from "./Rarities";

interface Roulette {
  items: any;
  opened: any;
  spin: boolean;

  className?: string;
}

const Roulette: React.FC<Roulette> = ({ items, opened, spin, className }) => {
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const [translateValue, setTranslateValue] = useState<string>("-6180px");
  const rouletteRef = useRef<HTMLDivElement | null>(null);

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

    const shuffle = (array: any[]) => {
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

        if (currentIndex === 36) {
          array[currentIndex] = opened.item;
        }
      }

      return array;
    };

    createRouletteItems();
  }, [items]);

  useEffect(() => {
    if (spin) {
      // Generate a random translateX value between -6090px and -6240px
      const randomTranslateX = -6090 - Math.floor(Math.random() * 151);
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
    <div className={`flex  max-w-[1100px] overflow-hidden ${className}`}>
      <div className="flex items-center gap-2" ref={rouletteRef}>
        {rouletteItems.map((item: any, index: number) => (
          <img
            key={index}
            src={item && item.image}
            alt={item && item.name}
            className={`min-w-[176px]  h-44 object-cover`}
            style={{
              borderBottom: Rarities.find((rarity) => rarity.id.toString() == item.rarity)?.color + " solid 4px",
            }}
          />
        ))}
        <style>{`
          @keyframes spin {
            from {
              transform: translateX(0%);
            }
            to {
              transform: translateX(${translateValue});
            }
          }
        `}</style>
      </div>
      <div className="absolute inset-y-0 left-0 w-24 h-full bg-gradient-to-r from-[#151225] via-transparent"></div>
      <div className="absolute inset-y-0 right-0 w-24 h-full bg-gradient-to-l from-[#151225] via-transparent"></div>
    </div>
  );
};

export default Roulette;





