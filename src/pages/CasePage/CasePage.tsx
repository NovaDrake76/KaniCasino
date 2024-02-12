import { useState, useEffect, useContext } from "react";
import { getCase } from "../../services/cases/CaseServices";
import Title from "../../components/Title";
import Item from "../../components/Item";
import Roulette from "../../components/Roulette";
import classNames from "classnames";
import { openBox } from "../../services/games/GamesServices";
import UserContext from "../../UserContext";
import MainButton from "../../components/MainButton";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { BasicItem } from "../../components/Types";
import ShowPrize from "./ShowPrize";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const [openedItems, setOpenedItems] = useState<BasicItem[]>([]);
  const [showPrize, setShowPrize] = useState<boolean>(false);
  const [hasSpinned, setHasSpinned] = useState<boolean>(false);
  const [animationAux, setAnimationAux] = useState<boolean>(false);
  const [animationAux2, setAnimationAux2] = useState<boolean>(false);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const [quantity, _setQuantity] = useState<number>(1);
  const { userData, toogleUserFlow } = useContext(UserContext);

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

  const resetProps = () => {
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
  }

  const openCase = async () => {

    if (userData == null) {
      toogleUserFlow(true);
      return;
    }

    setLoadingButton(true);

    try {
      const response = await openBox(id, quantity);
      setOpenedItems(response.items);
      // playAudio();
    } catch (error: any) {
      console.log(error);
      setLoadingButton(false);
      toast.error(`${error.response.data.message}!`, {
        theme: "dark",
      });
      return;
    }

    resetProps()
  };

  return (
    <div className="flex flex-col items-center w-screen">
      <div className="flex flex-col items-center overflow-hidden  md:max-w-[1920px]">
        <h1 className="text-2xl color-[#e1dde9] font-bold py-7">
          {loading ? <Skeleton width={200} height={30} /> : data && data.title}
        </h1>
        <div className="flex">
          <img
            src="/images/arrow.svg"
            alt="left arrow"
            className="hidden lg:flex"
          />
          <div className="flex flex-col overflow-hidden max-w-[120vw] md:w-[1100px] h-72 items-center justify-center border-y-4 border-[#16152c] relative z-10">
            <div className="absolute flex flex-col justify-between h-[calc(100%+50px)]  ">
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
                openedItem={openedItems[0]}
                spin={started}
                className={classNames({ "animate-fade-in-down": started })}

              />

            ) : (
              <ShowPrize openedItem={openedItems[0]} showPrize={showPrize} animationAux2={animationAux2} />
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
              text={userData == null ? "Sign in to play" : `Open Case - K₽${data.price}`}
              onClick={openCase}
              loading={loadingButton}
              disabled={
                loadingButton ||
                (userData && data.price > userData.walletBalance)
              }
            />
          )}
        </div>

        <div className="flex flex-col md:p-8 gap-2 items-center ">
          <Title title="Items in this case" />
          <div className="flex flex-wrap gap-6 px-8 justify-center w-screen max-w-[1920px]">
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
