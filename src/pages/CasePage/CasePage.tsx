import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { getCase } from "../../services/cases/CaseServices";
import Title from "../../components/Title";
import Item from "../../components/Item";
import { openBox } from "../../services/games/GamesServices";
import { sellItems } from "../../services/users/UserServices";
import UserContext from "../../UserContext";
import MainButton from "../../components/MainButton";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { BasicItem } from "../../components/Types";
import QuantityButton from "../../components/QuantityButton";
import RouletteContainer from "./RoulleteContainer";
import Monetary from '../../components/Monetary';

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
  const [quantity, setQuantity] = useState<number>(1);

  const { userData, toogleUserFlow, toogleUserData } = useContext(UserContext);
  const [sellingAll, setSellingAll] = useState<boolean>(false);
  const navigate = useNavigate();

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

  const sellOpened = async () => {
    const ids = openedItems.map((i) => i.uniqueId).filter(Boolean);
    if (!ids.length || sellingAll) return;
    setSellingAll(true);
    try {
      const res = await sellItems(ids);
      if (userData) {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      toast.success(res.message, { theme: "dark" });
      setShowPrize(false);
      setAnimationAux2(false);
      setHasSpinned(false);
      setOpenedItems([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not sell items", { theme: "dark" });
    }
    setSellingAll(false);
  };

  const openedSellTotal = openedItems.reduce((s, i) => s + (i.sellValue || 0), 0);

  const openCase = async () => {

    if (userData == null) {
      toogleUserFlow(true);
      return;
    }

    setLoadingButton(true);

    try {
      const response = await openBox(id, quantity);
      setOpenedItems(response.items);
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
    <div className="flex flex-col items-center w-screen relative">
      {!loading && data && (
        <button
          onClick={() => navigate(`/battles?add=${id}`)}
          className="absolute top-4 right-4 md:right-8 z-20 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm"
        >
          Add to battle
        </button>
      )}
      <div className="flex flex-col items-center overflow-hidden  md:max-w-[1920px]">
        <h1 className="text-2xl color-[#e1dde9] font-bold py-7">
          {loading ? <Skeleton width={200} height={30} /> : data && data.title}
        </h1>

        <RouletteContainer started={started} showPrize={showPrize} hasSpinned={hasSpinned} loading={loading} data={data} openedItems={openedItems} animationAux={animationAux} animationAux2={animationAux2} quantity={quantity} />
        <div
          className={`flex flex-col md:flex-row justify-center items-center gap-4 w-68 mt-8  ${started ? "opacity-0" : "opacity-100"} transition-all`}
        >

          {loading ? (
            <Skeleton width={240} height={40} />
          ) : (
            <div className="w-60 ml-0 md:ml-20">
              <MainButton
                text={userData == null ? "Sign in to play" : <div className="flex items-center justify-center text-base">
                <span className="mr-1">Open case - </span>{<Monetary value={data.price * quantity}/>}
                </div>}
                onClick={openCase}
                loading={loadingButton}
                disabled={
                  loadingButton ||
                  (userData && data.price > userData.walletBalance)
                }
              />
            </div>
          )}
          {
            !loading && (
              <QuantityButton quantity={quantity} setQuantity={setQuantity} disabled={started} />
            )
          }

          {showPrize && openedItems.length > 0 && openedSellTotal > 0 && (
            <button
              onClick={sellOpened}
              disabled={sellingAll}
              className="px-4 py-2 rounded bg-[#281D3F] hover:bg-green-700 font-semibold transition-all disabled:opacity-50"
            >
              {sellingAll ? "Selling..." : <span className="flex items-center gap-1">Sell {openedItems.length > 1 ? "all " : ""}<Monetary value={openedSellTotal} /></span>}
            </button>
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
