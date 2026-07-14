import CollectionsView from "./Collections.view";
import { useCollectionsServices } from "./Collections.services";

const Collections = () => {
  const service = useCollectionsServices();
  return <CollectionsView {...service} />;
};

export default Collections;
