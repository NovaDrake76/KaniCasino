import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import UserContext from "../../UserContext";
import {
  getCollectionsSummary,
  CollectionsSummary,
} from "../../services/collections/CollectionService";

export const useCollectionsServices = () => {
  const { userData } = useContext(UserContext);
  const [searchParams] = useSearchParams();

  const queryUser = searchParams.get("user");
  const targetUserId = queryUser || userData?.id || null;
  const isOwner = !!targetUserId && targetUserId === userData?.id;
  const userQuery = queryUser ? `?user=${queryUser}` : "";

  const [summary, setSummary] = useState<CollectionsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    getCollectionsSummary(targetUserId)
      .then((data) => {
        if (active) setSummary(data);
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
  }, [targetUserId]);

  const detailLink = (caseId: string) => `/collections/${caseId}${userQuery}`;

  return {
    summary,
    loading,
    error,
    isOwner,
    needsLogin: !targetUserId,
    detailLink,
  };
};
