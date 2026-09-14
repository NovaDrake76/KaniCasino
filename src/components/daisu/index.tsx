import { useDaisu } from "./Daisu.services";
import DaisuBubbleView from "./DaisuBubble.view";
import DaisuPopupView from "./DaisuPopup.view";
import DaisuRoomView from "./DaisuRoom.view";
import ChapterDone from "./roadmap/ChapterDone";
import "./daisu.css";

const DaisuDock = () => {
  const service = useDaisu();
  if (!service.enabled) return null;
  const view =
    service.stage === "room" ? (
      <DaisuRoomView {...service} />
    ) : service.stage === "popup" ? (
      <DaisuPopupView {...service} />
    ) : (
      <DaisuBubbleView {...service} />
    );
  return (
    <>
      {view}
      {service.chapterDone && (
        <ChapterDone done={service.chapterDone} roadmap={service.roadmap} game={service.bonusGame.name} onClose={service.closeChapterDone} />
      )}
    </>
  );
};

export default DaisuDock;
