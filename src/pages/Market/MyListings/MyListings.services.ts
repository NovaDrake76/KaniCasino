import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getMyListings, removeListing, MyListingsPage } from "../../../services/market/MarketService";
import { MyListingsProps } from "./MyListings.types";
import i18n from "../../../i18n";

export const useMyListings = ({ onChanged }: MyListingsProps) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MyListingsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await getMyListings(page);
      if (mine === seq.current) setData(res);
    } catch {
      if (mine === seq.current) setData(null);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (uniqueId: string) => {
    setRemoving(uniqueId);
    try {
      await removeListing(uniqueId);
      toast.success(i18n.t("market.listingRemoved"));
      onChanged();
    } catch {
      // a 404 here is usually a buyer who got there first, so the list is reloaded either way
      toast.error(i18n.t("market.couldNotRemoveListing"));
    } finally {
      setRemoving(null);
    }
    if (data && data.listings.length === 1 && page > 1) setPage(page - 1);
    else load();
  };

  return {
    loading,
    listings: data?.listings ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    page,
    setPage,
    removing,
    remove,
  };
};
