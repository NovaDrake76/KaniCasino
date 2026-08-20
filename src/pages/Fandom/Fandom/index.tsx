import FandomView from "./Fandom.view";
import { useFandomServices } from "./Fandom.services";

const Fandom = () => {
  const service = useFandomServices();
  return <FandomView {...service} />;
};

export default Fandom;
