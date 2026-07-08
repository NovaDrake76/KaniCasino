import TieBreakerView from "./TieBreaker.view";
import { useTieBreaker } from "./TieBreaker.services";
import { TieBreakerProps } from "./TieBreaker.types";

const TieBreaker: React.FC<TieBreakerProps> = (props) => {
  const service = useTieBreaker(props);
  return <TieBreakerView {...service} />;
};

export default TieBreaker;
