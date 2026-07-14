import { useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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

export const useCollectionDetailServices = () => {
  const { caseId = "" } = useParams();
  const { userData, toogleUserData } = useContext(UserContext);
  const [searchParams] = useSearchParams();

  const queryUser = searchParams.get("user");
  const targetUserId = queryUser || userData?.id || null;
  const isOwner = !!targetUserId && targetUserId === userData?.id;
  const userQuery = queryUser ? `?user=${queryUser}` : "";

  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const [page, setPage] = useState<number>(1);
  const [filter, setFilterState] = useState<AlbumFilter>("all");
  const [sortBy, setSortByState] = useState<AlbumSort>("mostRare");
  const [refresh, setRefresh] = useState<boolean>(false);

  const [selectedItem, setSelectedItem] = useState<AlbumItem | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selling, setSelling] = useState<boolean>(false);

  const [quicksellOpen, setQuicksellOpen] = useState<boolean>(false);
  const [quicksellPreview, setQuicksellPreview] = useState<QuicksellPreview | null>(null);
  const [quicksellLoading, setQuicksellLoading] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);

  useEffect(() => {
    if (!targetUserId || !caseId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    getCollection(caseId, targetUserId, { page, filter, sortBy })
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
  }, [caseId, targetUserId, page, filter, sortBy, refresh]);

  const setFilter = (f: AlbumFilter) => {
    setPage(1);
    setFilterState(f);
  };
  const setSortBy = (s: AlbumSort) => {
    setPage(1);
    setSortByState(s);
  };

  const openItem = (item: AlbumItem) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

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
    if (quicksellLoading) return;
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
        // the sale drifted; the server returned a fresh preview inline
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
    needsTarget: !targetUserId,
    backLink: `/collections${userQuery}`,
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
