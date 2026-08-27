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
import { FaGift } from "react-icons/fa";
import { getGrants } from "../../services/gift/GiftService";
import type { GiftGrant } from "../../services/gift/GiftService";
import FreeOpenings from "./FreeOpenings";
import { applyMeta } from "../../seo/meta";
import { caseMeta } from "../../seo/caseMeta";
import i18n from "../../i18n";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const [openedItems, setOpenedItems] = useState<BasicItem[]>([]);
  const [showPrize, setShowPrize] = useState<boolean>(false);
  const [animationAux, setAnimationAux] = useState<boolean>(false);
  const [animationAux2, setAnimationAux2] = useState<boolean>(false);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [grant, setGrant] = useState<GiftGrant | null>(null);

  const { userData, toogleUserFlow, toogleUserData } = useContext(UserContext);
  const [sellingAll, setSellingAll] = useState<boolean>(false);
  const navigate = useNavigate();

  //get id from url
  const id = window.location.pathname.split("/")[2];
  // the url may carry a slug, so anything that speaks to the api uses the resolved id
  const caseId = (data as any)?._id ?? id;
  const canonical = (data as any)?.slug as string | undefined;

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

  // a daily-gift grant pays for this case, so the page has to know about it before the
  // open button decides whether it is charging anything
  const getGrant = () => {
    if (!userData?.id || !(data as any)?._id) return setGrant(null);
    getGrants(caseId)
      .then((gs) => setGrant(gs[0] || null))
      .catch(() => setGrant(null));
  };

  useEffect(() => {
    getCaseInfo();
    //scroll to top
    window.scrollTo(0, 0);
  }, []);

  useEffect(getGrant, [userData?.id, (data as any)?._id]);

  // an id link becomes the slug once the case is known, so a shared link carries its name
  useEffect(() => {
    if (!canonical || !id || id === canonical) return;
    navigate(`/case/${canonical}`, { replace: true });
  }, [canonical, id]);

  // prerender bakes the real name into the html; PageMeta's generic /case/ entry would
  // overwrite it on hydration, so put it back once the case itself has loaded
  useEffect(() => {
    if (!data?.title) return;
    const { title, description } = caseMeta(data);
    applyMeta(title, description, `/case/${(data as any).slug || data._id || id}`);
  }, [data, id]);

  const resetProps = () => {
    setShowPrize(false);
    setAnimationAux2(false);

    // set, never toggled: as a toggle the case only flew away on every other open
    setAnimationAux(true);

    setTimeout(() => {
      setStarted(true);
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
    if (!ids.length || sellingAll || loadingButton) return;
    setSellingAll(true);
    try {
      const res = await sellItems(ids);
      if (userData) {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      toast.success(res.message, { theme: "dark" });
      setShowPrize(false);
      setAnimationAux2(false);
      // clear the fly-away too, or the idle case image replays it and holds at opacity 0
      setAnimationAux(false);
      setOpenedItems([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || i18n.t("casePage.couldNotSellItems"), { theme: "dark" });
    }
    setSellingAll(false);
  };

  const openedSellTotal = openedItems.reduce((s, i) => s + (i.sellValue || 0), 0);

  // the gift covers the open only while it has enough left for the chosen quantity
  const freeNow = !!grant && grant.remaining >= quantity;

  const openCase = async () => {

    if (userData == null) {
      toogleUserFlow(true);
      return;
    }

    setLoadingButton(true);

    try {
      const response = await openBox(caseId, quantity, freeNow ? grant?.grantId : undefined);
      setOpenedItems(response.items);
      if (freeNow) getGrant();
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
    <div className="flex flex-col items-center w-full relative">
      {!loading && data && (
        <button
          onClick={() => navigate(`/battles?add=${id}`)}
          className="self-end mr-4 mt-4 md:absolute md:top-4 md:right-8 md:mr-0 md:mt-0 z-20 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm"
        >
          {i18n.t("casePage.addToBattle")}
        </button>
      )}
      <div className="flex w-full flex-col items-center overflow-hidden md:max-w-[1920px]">
        <h1 className="text-2xl color-[#e1dde9] font-bold py-7">
          {loading ? <Skeleton width={200} height={30} /> : data && data.title}
        </h1>

        {grant && !started && (
          <div className="mb-2">
            <FreeOpenings grant={grant} />
          </div>
        )}

        <RouletteContainer started={started} showPrize={showPrize} loading={loading} data={data} openedItems={openedItems} animationAux={animationAux} animationAux2={animationAux2} quantity={quantity} />
        <div
          className={`flex flex-col md:flex-row justify-center items-center gap-4 w-68 mt-8  ${started ? "opacity-0" : "opacity-100"} transition-all`}
        >

          {loading ? (
            <Skeleton width={240} height={40} />
          ) : (
            <div className="w-60 ml-0 md:ml-20">
              <MainButton
                text={userData == null ? i18n.t("upgrade.signInToPlay") : freeNow ? (
                  <div className="flex items-center justify-center gap-1 text-base">
                    <FaGift />
                    <span>{quantity > 1 ? i18n.t("casePage.openFreeCount", { count: quantity }) : i18n.t("casePage.openFree")}</span>
                  </div>
                ) : <div className="flex items-center justify-center text-base">
                <span className="mr-1">{i18n.t("casePage.openCase")} </span>{<Monetary value={data.price * quantity}/>}
                </div>}
                onClick={openCase}
                loading={loadingButton}
                disabled={
                  loadingButton ||
                  sellingAll ||
                  (!freeNow && userData && data.price > userData.walletBalance)
                }
              />
            </div>
          )}
          {
            !loading && (
              <QuantityButton quantity={quantity} setQuantity={setQuantity} disabled={started} />
            )
          }

          {showPrize && !loadingButton && openedItems.length > 0 && openedSellTotal > 0 && (
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
          <Title title={i18n.t("casePage.itemsInThisCase")} />
          <div className="flex flex-wrap gap-6 px-8 justify-center w-full max-w-[1920px]">
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
