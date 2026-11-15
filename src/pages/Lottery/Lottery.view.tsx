import GameLayout from "../../components/game/GameLayout";
import Stage from "./Stage";
import PickPanel from "./PickPanel";
import DrawHistory from "./DrawHistory";
import { LastDraw, MyTickets } from "./DrawPanels";
import { LotteryViewProps } from "./Lottery.types";
import i18n from "../../i18n";

const LotteryView: React.FC<LotteryViewProps> = ({ stage, panel, myTickets, lastDraw, history }) => (
  <div className="relative w-full overflow-x-clip">
    <GameLayout
      game="lottery"
      feed={false}
      title={i18n.t("lottery.lottery")}
      panel={<PickPanel panel={panel} />}
      footer={
        <div className="flex w-full max-w-[1200px] flex-col gap-4">
          <div className={`grid grid-cols-1 gap-4 ${myTickets ? "lg:grid-cols-2" : ""}`}>
            {myTickets && <MyTickets tickets={myTickets} />}
            <LastDraw draw={lastDraw} />
          </div>
          <DrawHistory history={history} />
        </div>
      }
    >
      <Stage stage={stage} />
    </GameLayout>
  </div>
);

export default LotteryView;
