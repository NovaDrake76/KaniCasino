import { useState } from "react";
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
// click without leaving the profile page.
const CollectionsPanel: React.FC<Props> = ({ userId, isOwner }) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  if (selectedCaseId) {
    return (
      <CollectionAlbum
        userId={userId}
        isOwner={isOwner}
        caseId={selectedCaseId}
        onBack={() => setSelectedCaseId(null)}
      />
    );
  }
  return <CollectionSummary userId={userId} isOwner={isOwner} onOpenCase={setSelectedCaseId} />;
};

export default CollectionsPanel;
