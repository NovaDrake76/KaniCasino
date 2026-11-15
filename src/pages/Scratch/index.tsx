import ScratchView from "./Scratch.view";
import { useScratchServices } from "./Scratch.services";

const Scratch = () => {
  const service = useScratchServices();
  return <ScratchView {...service} />;
};

export default Scratch;
