import ProvablyFairView from "./ProvablyFair.view";
import { useProvablyFairServices } from "./ProvablyFair.services";

const ProvablyFair = () => {
  const service = useProvablyFairServices();
  return <ProvablyFairView {...service} />;
};

export default ProvablyFair;
