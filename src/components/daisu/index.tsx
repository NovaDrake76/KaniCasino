import { useDaisu } from "./Daisu.services";
import DaisuBubbleView from "./DaisuBubble.view";
import DaisuPopupView from "./DaisuPopup.view";
import DaisuRoomView from "./DaisuRoom.view";
import ChapterDone from "./roadmap/ChapterDone";
import BuyCard from "./shop/BuyCard";
import UnlockedCard from "./shop/UnlockedCard";
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
      {service.pickedItem && (
        <BuyCard
          item={service.pickedItem}
          walletBalance={service.walletBalance}
          level={service.level}
          buying={service.buying}
          onBuy={service.buyItem}
          onClose={service.closePick}
          onShowMe={service.pickedItem.kind === "unlock" ? service.showItem : undefined}
        />
      )}
      {service.unlockedItem && (
        <UnlockedCard item={service.unlockedItem} onShowMe={service.unlockedItem.kind === "unlock" ? service.showUnlocked : undefined} onLater={service.closeUnlocked} />
      )}
    </>
  );
};

export default DaisuDock;
