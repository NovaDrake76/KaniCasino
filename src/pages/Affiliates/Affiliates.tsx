import { useAffiliatesServices } from "./Affiliates.services";
import AffiliatesView from "./Affiliates.view";

const Affiliates = () => <AffiliatesView {...useAffiliatesServices()} />;

export default Affiliates;
