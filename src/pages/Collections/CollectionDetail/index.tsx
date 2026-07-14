import CollectionDetailView from "./CollectionDetail.view";
import { useCollectionDetailServices } from "./CollectionDetail.services";

const CollectionDetail = () => {
  const service = useCollectionDetailServices();
  return <CollectionDetailView {...service} />;
};

export default CollectionDetail;
