import PotChipView from "./PotChip.view";
import { usePotChip } from "./PotChip.services";

const PotChip = () => {
  const service = usePotChip();
  return <PotChipView {...service} />;
};

export default PotChip;
