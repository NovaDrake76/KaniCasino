import { useBackofficeServices } from "./Backoffice.services";
import BackofficeView from "./Backoffice.view";

const Backoffice = () => <BackofficeView {...useBackofficeServices()} />;

export default Backoffice;
