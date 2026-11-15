import ScratchCoatingView from "./ScratchCoating.view";
import { useScratchCoating } from "./ScratchCoating.services";
import { ScratchCoatingProps } from "./ScratchCoating.types";

const ScratchCoating: React.FC<ScratchCoatingProps> = (props) => {
  const service = useScratchCoating(props);
  return <ScratchCoatingView {...service} />;
};

export default ScratchCoating;
