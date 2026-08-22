import PredictionsView from "./Predictions.view";
import { usePredictionsServices } from "./Predictions.services";

const Predictions = () => {
  const service = usePredictionsServices();
  return <PredictionsView {...service} />;
};

export default Predictions;
