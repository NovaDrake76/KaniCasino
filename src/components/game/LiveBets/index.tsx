import { useLiveBetsServices } from "./LiveBets.services";
import LiveBetsView from "./LiveBets.view";

const LiveBets = () => {
    const service = useLiveBetsServices();
    return <LiveBetsView {...service} />;
};

export default LiveBets;
