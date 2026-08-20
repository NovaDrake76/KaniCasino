import FandomBoardView from "./FandomBoard.view";
import { useFandomBoardServices } from "./FandomBoard.services";

const FandomBoard = () => {
  const service = useFandomBoardServices();
  return <FandomBoardView {...service} />;
};

export default FandomBoard;
