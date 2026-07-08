import BattleRoomView from "./BattleRoom.view";
import { useBattleRoomServices } from "./BattleRoom.services";

const BattleRoom = () => {
  const service = useBattleRoomServices();
  return <BattleRoomView {...service} />;
};

export default BattleRoom;
