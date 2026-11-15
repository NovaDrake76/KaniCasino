import ClockView from "./Clock.view";
import { useClock } from "./Clock.services";
import { ClockProps } from "./Clock.types";

const Clock: React.FC<ClockProps> = (props) => {
  const service = useClock(props);
  return <ClockView {...service} />;
};

export default Clock;
