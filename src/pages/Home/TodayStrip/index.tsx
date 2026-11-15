import TodayStripView from "./TodayStrip.view";
import { useTodayStrip } from "./TodayStrip.services";

const TodayStrip = () => {
  const service = useTodayStrip();
  return <TodayStripView {...service} />;
};

export default TodayStrip;
