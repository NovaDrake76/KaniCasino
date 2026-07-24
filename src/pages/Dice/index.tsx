import DiceView from "./Dice.view";
import { useDiceServices } from "./Dice.services";

const Dice = () => {
  const service = useDiceServices();
  return <DiceView {...service} />;
};

export default Dice;
