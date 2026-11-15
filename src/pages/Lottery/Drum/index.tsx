import DrumView from "./Drum.view";
import { useDrum } from "./Drum.services";
import { DrumProps } from "./Drum.types";

const Drum: React.FC<DrumProps> = (props) => {
  const service = useDrum(props);
  return <DrumView {...service} />;
};

export default Drum;
