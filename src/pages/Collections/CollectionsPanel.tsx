import { useSearchParams } from "react-router-dom";
import CollectionsView from "./Collections.view";
import { useCollectionsServices } from "./Collections.services";
import CollectionDetailView from "./CollectionDetail/CollectionDetail.view";
import { useCollectionDetailServices } from "./CollectionDetail/CollectionDetail.services";

interface Props {
  userId: string;
  isOwner: boolean;
}

const CollectionSummary: React.FC<{
  userId: string;
  isOwner: boolean;
  onOpenCase: (id: string) => void;
}> = ({ userId, isOwner, onOpenCase }) => {
  const service = useCollectionsServices({ userId, isOwner, onOpenCase });
  return <CollectionsView {...service} />;
};

const CollectionAlbum: React.FC<{
  userId: string;
  isOwner: boolean;
  caseId: string;
  onBack: () => void;
}> = ({ userId, isOwner, caseId, onBack }) => {
  const service = useCollectionDetailServices({ userId, isOwner, caseId, onBack });
  return <CollectionDetailView {...service} />;
};

// the collections tab: shows the album grid, and swaps to a single case's album on
// click without leaving the profile page. the open case lives in the url so leaving
// for the market and coming back restores it.
const CollectionsPanel: React.FC<Props> = ({ userId, isOwner }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCaseId = searchParams.get("case");

  // the open item and the album view belong to whichever case was open, so they go
  // whenever the case does: a duplicates filter must not leak into the next album.
  const clearAlbum = (params: URLSearchParams) => {
    params.delete("item");
    params.delete("page");
    params.delete("filter");
    params.delete("sort");
  };

  // copy before writing: the params object is memoized on location.search, so
  // mutating it in place corrupts the memo for the rest of this location.
  const openCase = (caseId: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("case", caseId);
        clearAlbum(next);
        return next;
      },
      { replace: true }
    );

  const back = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("case");
        clearAlbum(next);
        return next;
      },
      { replace: true }
    );

  if (selectedCaseId) {
    return (
      <CollectionAlbum
        userId={userId}
        isOwner={isOwner}
        caseId={selectedCaseId}
        onBack={back}
      />
    );
  }
  return <CollectionSummary userId={userId} isOwner={isOwner} onOpenCase={openCase} />;
};

export default CollectionsPanel;
