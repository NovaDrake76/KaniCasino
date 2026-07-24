import HiloView from "./Hilo.view";
import { useHiloServices } from "./Hilo.services";

const Hilo = () => {
  const service = useHiloServices();
  return <HiloView {...service} />;
};

export default Hilo;
