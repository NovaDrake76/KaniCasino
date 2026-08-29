import { useLeaderboardServices } from "./Leaderboard.services";
import LeaderboardView from "./Leaderboard.view";

const Leaderboard = ({ aside }: { aside?: React.ReactNode }) => {
    const service = useLeaderboardServices();
    return <LeaderboardView {...service} aside={aside} />;
};

export default Leaderboard;
