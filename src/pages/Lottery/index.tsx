import LotteryView from "./Lottery.view";
import { useLotteryServices } from "./Lottery.services";

const Lottery = () => {
  const service = useLotteryServices();
  return <LotteryView {...service} />;
};

export default Lottery;
