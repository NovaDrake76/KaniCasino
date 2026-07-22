import BlackjackView from "./Blackjack.view";
import { useBlackjackServices } from "./Blackjack.services";

const Blackjack = () => {
  const services = useBlackjackServices();
  return <BlackjackView {...services} />;
};

export default Blackjack;
