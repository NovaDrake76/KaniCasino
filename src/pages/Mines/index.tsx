import MinesView from "./Mines.view";
import { useMinesServices } from "./Mines.services";

const Mines = () => {
  const service = useMinesServices();
  return <MinesView {...service} />;
};

export default Mines;
