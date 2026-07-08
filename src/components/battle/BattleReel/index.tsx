import BattleReelView from "./BattleReel.view";
import { useBattleReel } from "./BattleReel.services";
import { BattleReelProps } from "./BattleReel.types";

const BattleReel: React.FC<BattleReelProps> = (props) => {
  const service = useBattleReel(props);
  return <BattleReelView {...service} />;
};

export default BattleReel;
