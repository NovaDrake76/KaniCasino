import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import { getOrderBook, sellIntoOrders, OrderBookPage, OrderBookRow, OrderBookSort } from "../../../services/market/MarketService";
import { useLocked } from "../../../components/daisu/shop/useLocked";
import { openDaisuShop } from "../../../components/daisu/tour/tourEvents";
import { handleAccountLock } from "../../../components/verify/verifyEvents";
import { clampDigits } from "../../../utils/digits";
import i18n from "../../../i18n";

export const useOrderBook = () => {
  const { userData, isLogged } = useContext(UserContext);
  const locked = useLocked("tradersLicense");
  const [page, setPage] = useState(1);
  const [sort, setSortState] = useState<OrderBookSort>("gain");
  const [data, setData] = useState<OrderBookPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState<OrderBookRow | null>(null);
  const [quantityText, setQuantityText] = useState("1");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await getOrderBook(page, sort);
      if (mine === seq.current) setData(res);
    } catch {
      if (mine === seq.current) setData(null);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const setSort = (next: OrderBookSort) => {
    setSortState(next);
    setPage(1);
  };

  const isFavorite = (row: OrderBookRow) => !!userData?.favoriteItems?.includes(String(row.item._id));

  const startSell = (row: OrderBookRow) => {
    if (locked) return openDaisuShop("tradersLicense");
    if (isFavorite(row)) {
      toast.info(i18n.t("common.favoriteLocked"), { theme: "dark" });
      return;
    }
    setSelling(row);
    setQuantityText(String(Math.max(1, Math.min(row.owned || 1, row.atBest))));
  };

  const closeSell = () => setSelling(null);

  const confirmSell = async () => {
    if (!selling) return;
    const quantity = clampDigits(quantityText, 1, selling.owned || 1, 1);
    setBusy(true);
    try {
      const res = await sellIntoOrders(String(selling.item._id), selling.bestBid, quantity);
      const words = { sold: res.sold, received: res.received, returned: res.returned };
      toast.success(i18n.t(res.returned ? "market.soldIntoOrdersSomeKept" : "market.soldIntoOrders", words), { theme: "dark" });
      setSelling(null);
      load();
    } catch (error: unknown) {
      const answer = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (answer?.code === "no-bid") {
        toast.info(i18n.t("market.orderGone"), { theme: "dark" });
        setSelling(null);
        load();
      } else if (!handleAccountLock(error, "market")) {
        toast.error(answer?.message || i18n.t("market.couldNotSell"), { theme: "dark" });
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
    rows: data?.orders ?? [],
    totalPages: data?.totalPages ?? 1,
    page,
    setPage,
    sort,
    setSort,
    isLogged: !!isLogged,
    isFavorite,
    startSell,
    selling,
    closeSell,
    quantityText,
    setQuantityText,
    confirmSell,
    busy,
  };
};
