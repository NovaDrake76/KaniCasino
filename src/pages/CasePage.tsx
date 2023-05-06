import { useState, useEffect } from "react";
import { getCase } from "../services/cases/CaseServices";
import Title from "../components/Title";
import Item from "../components/Item";
import Roulette from "../components/Roullete";
import classNames from "classnames";
import Rarities from "../components/Rarities";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<any>(null);
  const [showPrize, setShowPrize] = useState<boolean>(false);
  const [hasSpinned, setHasSpinned] = useState<boolean>(false);
  const [animationAux, setAnimationAux] = useState<boolean>(false);

  //get id from url
  const id = window.location.pathname.split("/")[2];

  const getCaseInfo = async () => {
    getCase(id)
      .then((response) => {
        setData(response);
      })
      .catch((error: any) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getCaseInfo();
  }, []);

  const openCase = () => {
    setShowPrize(false);
    setAnimationAux(!animationAux);
    setOpenedItem(data.items[Math.floor(Math.random() * data.items.length)]);

    setTimeout(() => {
      setStarted(true);
      setHasSpinned(true);
    }, 500);

    setTimeout(() => {
      setStarted(false);
      setShowPrize(true);
    }, 7500);
  };

  return (
    <div className="flex flex-col items-center w-screen">
      {loading ? (
        <div>
          <h1>Loading...</h1>
        </div>
      ) : (
        data && (
          <div className="flex flex-col items-center max-w-[1920px]">
            <h1 className="text-2xl color-[#e1dde9] font-bold py-7">
              {data.title}
            </h1>
            <div className="flex">
              <img src="/images/arrow.svg" alt="left arrow" />
              <div className="flex flex-col w-[1100px] h-72 items-center justify-center border-y-4 border-[#16152c] relative">
                <div className="absolute flex flex-col justify-between h-[calc(100%+50px)] z-20 ">
                  <img
                    src="/images/arrowSelector.svg"
                    alt="top arrow"
                    style={{
                      transform: "rotate(180deg)",
                    }}
                  />
                  <img src="/images/arrowSelector.svg" alt="bottom arrow" />
                </div>
                {!started && !showPrize && !hasSpinned ? (
                  <img
                    src={data.image}
                    alt={data.title}
                    className={classNames(
                      "w-52 h-52 object-cover z-10",
                      { "animate-bounce-up-fade": animationAux },
                      "transition duration-500"
                    )}
                    id="caseImage"
                  />
                ) : started && !showPrize ? (
                  <Roulette
                    items={data.items}
                    opened={openedItem}
                    spin={started}
                    className={classNames({ "animate-fade-in-down": started })}
                  />
                ) : (
                  <div id="prize" className={` animate-fade-in`}>
                    <img
                      src={openedItem.image}
                      alt={openedItem.name}
                      className={`w-48 h-48 object-cover rounded ${
                        showPrize ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                )}
              </div>

              <img
                src="/images/arrow.svg"
                alt="right arrow"
                style={{
                  transform: "rotate(180deg)",
                }}
              />
            </div>
            <button onClick={openCase} className="mt-4">
              Open Case
            </button>

            <div className="flex flex-col p-8 gap-2 items-center ">
              <Title title="Items in this case" />
              <div className="flex flex-wrap gap-6  justify-center ">
                {data.items.map((item: any) => (
                  <Item item={item} key={item.name} />
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default CasePage;
