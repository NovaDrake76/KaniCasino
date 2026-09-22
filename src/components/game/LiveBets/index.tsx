import { useLiveBetsServices } from "./LiveBets.services";
import LiveBetsView from "./LiveBets.view";
import LockedBanner from "../../daisu/shop/LockedBanner";
import { useLocked } from "../../daisu/shop/useLocked";

const Feed = () => {
    const service = useLiveBetsServices();
    return <LiveBetsView {...service} />;
};

// the strip is bought in her shop by an account in her beta; until then it is a locked strip in the same place, and the feed is not even asked for
const LiveBets = () => {
    const locked = useLocked("spyglass");
    if (locked) {
        return (
            <div className="w-full max-w-[1200px] mt-6">
                <LockedBanner unlock="spyglass" />
            </div>
        );
    }
    return <Feed />;
};

export default LiveBets;
