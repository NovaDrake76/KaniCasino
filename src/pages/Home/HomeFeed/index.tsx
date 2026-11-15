import { BoardFeedContext, PotFeedContext } from "./HomeFeed.context";
import { useBoardFeed, usePotFeed } from "./HomeFeed.services";

// the pot and the board are read once for the whole home page; a change re-renders only the parts that read them
const HomeFeed = ({ children }: { children: React.ReactNode }) => {
  const pot = usePotFeed();
  const board = useBoardFeed();
  return (
    <PotFeedContext.Provider value={pot}>
      <BoardFeedContext.Provider value={board}>{children}</BoardFeedContext.Provider>
    </PotFeedContext.Provider>
  );
};

export default HomeFeed;
