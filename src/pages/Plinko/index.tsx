import PlinkoView from "./Plinko.view";
import { usePlinkoServices } from "./Plinko.services";

const Plinko = () => {
  const service = usePlinkoServices();
  return <PlinkoView {...service} />;
};

export default Plinko;
