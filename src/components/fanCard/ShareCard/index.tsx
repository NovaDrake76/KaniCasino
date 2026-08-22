import { useShareCardServices } from "./ShareCard.services";
import ShareCardView from "./ShareCard.view";
import { ShareCardProps } from "./ShareCard.types";

const ShareCard: React.FC<ShareCardProps> = (props) => {
  const service = useShareCardServices(props);
  return <ShareCardView {...service} />;
};

export default ShareCard;
