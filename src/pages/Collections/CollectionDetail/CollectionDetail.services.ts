import { useContext, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import { sellItems } from "../../../services/users/UserServices";
import {
  getCollection,
  previewQuicksell,
  commitQuicksell,
  CollectionDetail,
  AlbumItem,
  QuicksellPreview,
} from "../../../services/collections/CollectionService";

export type AlbumFilter = "all" | "owned" | "missing" | "duplicates";
export type AlbumSort = "mostRare" | "mostCommon";

interface Args {
  userId: string;
  isOwner: boolean;
  caseId: string;
  onBack: () => void;
}

export const useCollectionDetailServices = ({ userId, isOwner, caseId, onBack }: Args) => {
  const { userData, toogleUserData } = useContext(UserContext);

  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const [page, setPage] = useState<number>(1);
  const [filter, setFilterState] = useState<AlbumFilter>("all");
  const [sortBy, setSortByState] = useState<AlbumSort>("mostRare");
  const [refresh, setRefresh] = useState<boolean>(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const itemParam = searchParams.get("item");
  const [selling, setSelling] = useState<boolean>(false);

  const [quicksellOpen, setQuicksellOpen] = useState<boolean>(false);
  const [quicksellPreview, setQuicksellPreview] = useState<QuicksellPreview | null>(null);
  const [quicksellLoading, setQuicksellLoading] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);

  useEffect(() => {
    if (!userId || !caseId) return;
    let active = true;
    setLoading(true);
    setError(false);
    getCollection(caseId, userId, { page, filter, sortBy })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId, userId, page, filter, sortBy, refresh]);

  const setFilter = (f: AlbumFilter) => {
    setPage(1);
    setFilterState(f);
  };
  const setSortBy = (s: AlbumSort) => {
    setPage(1);
    setSortByState(s);
  };

  // the open item lives in the url, so returning from the market reopens it. items and
  // extras are disjoint by _id, so the first hit is unambiguous.
  const selectedItem: AlbumItem | null =
    (itemParam && detail
      ? detail.items.find((i) => i._id === itemParam) ??
        detail.extras.find((i) => i._id === itemParam)
      : undefined) ?? null;
  const modalOpen = selectedItem !== null;

  const writeItem = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("item", id);
        else next.delete("item");
        return next;
      },
      { replace: true }
    );

  // a refetch keeps the old rows on screen (the skeleton only covers the first load),
  // so ignore clicks on rows that are about to be replaced: the item may not survive
  // the new result set, and the modal would open and then vanish.
  const openItem = (item: AlbumItem) => {
    if (loading) return;
    writeItem(item._id);
  };

  // keeps the view/modal contract: Modal only ever calls setOpen(false).
  const setModalOpen: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? value(modalOpen) : value;
    if (!next && itemParam) writeItem(null);
  };

  // an ?item= we cannot resolve against the loaded album (it sits on another page, or
  // it is gone) has to be dropped, or it pops the modal open unbidden the moment the
  // user pages to the page that happens to hold it. loading covers the refetch window,
  // and the album unmounts on a case change, so detail always belongs to this caseId.
  useEffect(() => {
    if (!itemParam || loading || !detail || selectedItem) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("item");
        return next;
      },
      { replace: true }
    );
  }, [itemParam, loading, detail, selectedItem, setSearchParams]);

  const handleSellOne = async (uniqueId: string) => {
    if (selling) return;
    setSelling(true);
    try {
      const res = await sellItems([uniqueId]);
      if (userData) {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      toast.success(res.message, { theme: "dark" });
      setModalOpen(false);
      setRefresh((r) => !r);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not sell item", { theme: "dark" });
    } finally {
      setSelling(false);
    }
  };

  const openQuicksell = async () => {
    if (quicksellLoading || committing) return;
    setQuicksellLoading(true);
    try {
      const p = await previewQuicksell(caseId);
      setQuicksellPreview(p);
      setQuicksellOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not load duplicates", { theme: "dark" });
    } finally {
      setQuicksellLoading(false);
    }
  };

  const confirmQuicksell = async () => {
    if (!quicksellPreview || committing) return;
    setCommitting(true);
    try {
      const res = await commitQuicksell(caseId, quicksellPreview.plan);
      if (res.changed) {
        setQuicksellPreview({
          caseId,
          lines: res.lines || [],
          totalItems: res.totalItems || 0,
          totalValue: res.totalValue || 0,
          plan: res.plan || [],
        });
        toast.info("Your items changed since the preview. Review the update and confirm again.", {
          theme: "dark",
        });
        setRefresh((r) => !r);
        return;
      }
      if (userData && typeof res.walletBalance === "number") {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      if (res.sold) {
        toast.success(`Quicksold ${res.sold} duplicate${res.sold > 1 ? "s" : ""} for K₽${res.value}`, {
          theme: "dark",
        });
      } else {
        toast.info("Nothing to sell.", { theme: "dark" });
      }
      setQuicksellOpen(false);
      setQuicksellPreview(null);
      setRefresh((r) => !r);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not sell duplicates", { theme: "dark" });
    } finally {
      setCommitting(false);
    }
  };

  return {
    caseId,
    detail,
    loading,
    error,
    isOwner,
    onBack,
    page,
    setPage,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    selectedItem,
    modalOpen,
    setModalOpen,
    selling,
    openItem,
    handleSellOne,
    quicksellOpen,
    setQuicksellOpen,
    quicksellPreview,
    quicksellLoading,
    committing,
    openQuicksell,
    confirmQuicksell,
  };
};
