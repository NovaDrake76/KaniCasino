import { useState, useEffect, useContext } from "react";
import { getCase } from "../services/cases/CaseServices";
import Title from "../components/Title";
import Item from "../components/Item";
import Roulette from "../components/Roullete";
import classNames from "classnames";
import Rarities from "../components/Rarities";
import { openBox } from "../services/games/GamesServices";
import UserContext from "../UserContext";
import MainButton from "../components/MainButton";
import Skeleton from "react-loading-skeleton";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<any>(null);
  const [showPrize, setShowPrize] = useState<boolean>(false);
  const [hasSpinned, setHasSpinned] = useState<boolean>(false);
  const [animationAux, setAnimationAux] = useState<boolean>(false);
  const [animationAux2, setAnimationAux2] = useState<boolean>(false);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const { userData, toogleUserData } = useContext(UserContext);

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
    //scroll to top
    window.scrollTo(0, 0);
  }, []);

  // let audio = new Audio("/open.mp3");

  // const playAudio = () => {
  //   audio.play();
  // };

  const openCase = async () => {
    setLoadingButton(true);
    try {
      const response = await openBox(id, userData.id);
      toogleUserData({
        ...userData,
        walletBalance: userData.walletBalance - data.price,
        xp: userData.xp + 5 * data.price,
        level:
          userData.xp + 5 * data.price >= (userData.level + 1) * 1000
            ? userData.level + 1
            : userData.level,
      });
      setOpenedItem(response);
      // playAudio();
    } catch (error) {
      console.log(error);
      setLoadingButton(false);
      return;
    }

    setShowPrize(false);
    setAnimationAux2(false);

    setAnimationAux(!animationAux);

    setTimeout(() => {
      setStarted(true);
      setHasSpinned(true);
    }, 500);

    setTimeout(() => {
      setStarted(false);
      setShowPrize(true);
    }, 7500);

    setTimeout(() => {
      setAnimationAux2(true);
      setLoadingButton(false);
    }, 8000);
  };

  return (
    <div className="flex flex-col items-center w-screen">
      <div className="flex flex-col items-center max-w-[1920px]">
        <h1 className="text-2xl color-[#e1dde9] font-bold py-7">
          {loading ? <Skeleton width={200} height={30} /> : data && data.title}
        </h1>
        <div className="flex">
          <img
            src="/images/arrow.svg"
            alt="left arrow"
            className="hidden lg:flex"
          />
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
              loading ? (
                <Skeleton width={208} height={208} />
              ) : (
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
              )
            ) : started && !showPrize ? (
              <Roulette
                items={data.items}
                opened={openedItem}
                spin={started}
                className={classNames({ "animate-fade-in-down": started })}
              />
            ) : (
              <div id="prize" className={`animate-fade-in flex  relative`}>
                <img
                  src={openedItem.item.image}
                  alt={openedItem.item.name}
                  className={`w-48 h-48 object-contain rounded ${showPrize ? "opacity-100" : "opacity-0"
                    }`}
                />
                {animationAux2 && (
                  <div
                    className={`notched h-48 w-48 transition-all animate-fade-in-left absolute left-[210px] items-center justify-center z-20 hidden md:flex`}
                    style={{
                      background: Rarities.find(
                        (rarity) => rarity.id == openedItem.item.rarity
                      )?.color,
                    }}
                  >
                    <div
                      className={`notched h-[184px] w-[184px] transition-all bg-[#151225] z-30 flex flex-col items-center justify-center`}
                    >
                      <span className="text-xl font-bold color-[#e1dde9] text-center">
                        {openedItem.item.name}
                      </span>
                      <span
                        className="text-xl underline "
                        style={{
                          color: Rarities.find(
                            (rarity) => rarity.id == openedItem.item.rarity
                          )?.color,
                        }}
                      >
                        {
                          Rarities.find(
                            (rarity) => rarity.id == openedItem.item.rarity
                          )?.name
                        }
                      </span>
                      <div
                        style={{
                          width: "1px",
                          boxShadow: `0px 0px 80px 30px ${Rarities.find(
                            (rarity) => rarity.id == openedItem.item.rarity
                          )?.color
                            }`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <img
            src="/images/arrow.svg"
            alt="right arrow"
            className="hidden lg:flex"
            style={{
              transform: "rotate(180deg)",
            }}
          />
        </div>

        <div
          className={`w-60 mt-8 ${started ? "opacity-0" : "opacity-100"
            } transition-all

            `}
        >
          {loading ? (
            <Skeleton width={240} height={40} />
          ) : (
            <MainButton
              text={`Open Case - C₽${data.price}`}
              onClick={openCase}
              loading={loadingButton}
              disabled={
                loadingButton ||
                !userData ||
                (userData && data.price > userData.walletBalance)
              }
            />
          )}
        </div>

        <div className="flex flex-col p-8 gap-2 items-center ">
          <Title title="Items in this case" />
          <div className="flex flex-wrap gap-6 justify-center w-screen max-w-[1920px]">
            {loading
              ? { array: Array(12).fill(0) }.array.map((_, i) => (
                <Skeleton
                  width={176}
                  height={216}
                  highlightColor="#161427"
                  baseColor="#1c1a31"
                  key={i}
                />
              ))
              : data.items.map((item: any) => (
                <Item item={item} key={item.name} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CasePage;
