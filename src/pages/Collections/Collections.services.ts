import { useEffect, useState } from "react";
import {
  getCollectionsSummary,
  CollectionsSummary,
} from "../../services/collections/CollectionService";

interface Args {
  userId: string;
  onOpenCase: (caseId: string) => void;
}

export const useCollectionsServices = ({ userId, onOpenCase }: Args) => {
  const [summary, setSummary] = useState<CollectionsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError(false);
    getCollectionsSummary(userId)
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
  }, [userId]);

  return { summary, loading, error, openCase: onOpenCase };
};
