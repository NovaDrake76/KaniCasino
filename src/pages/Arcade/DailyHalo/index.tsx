import { useDailyHalo } from "./DailyHalo.services";
import DailyHaloView from "./DailyHalo.view";

const DailyHalo = () => {
  const service = useDailyHalo();
  return <DailyHaloView {...service} />;
};

export default DailyHalo;
