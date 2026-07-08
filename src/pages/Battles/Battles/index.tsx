import BattlesView from "./Battles.view";
import { useBattlesServices } from "./Battles.services";

const Battles = () => {
  const service = useBattlesServices();
  return <BattlesView {...service} />;
};

export default Battles;
