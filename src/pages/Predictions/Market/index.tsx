import MarketView from "./Market.view";
import { useMarketServices } from "./Market.services";

const PredictionMarket = () => {
  const service = useMarketServices();
  return <MarketView {...service} />;
};

export default PredictionMarket;
