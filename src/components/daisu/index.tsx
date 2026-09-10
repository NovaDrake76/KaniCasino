import { useDaisu } from "./Daisu.services";
import DaisuBubbleView from "./DaisuBubble.view";
import DaisuPopupView from "./DaisuPopup.view";
import DaisuRoomView from "./DaisuRoom.view";
import "./daisu.css";

const DaisuDock = () => {
  const service = useDaisu();
  if (!service.enabled) return null;
  if (service.stage === "room") return <DaisuRoomView {...service} />;
  if (service.stage === "popup") return <DaisuPopupView {...service} />;
  return <DaisuBubbleView {...service} />;
};

export default DaisuDock;
