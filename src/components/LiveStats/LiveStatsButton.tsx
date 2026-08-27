import { MdOutlineShowChart } from "react-icons/md";
import { GameBarButton } from "../game/GameBar";
import LiveStats from "./LiveStats";
import { useSessionStats } from "../../stats/SessionStatsContext";
import i18n from "../../i18n";

const LiveStatsButton = () => {
    const { open, setOpen } = useSessionStats();
    return (
        <>
            <GameBarButton onClick={() => setOpen(!open)} label={i18n.t("liveStats.title")} active={open}>
                <MdOutlineShowChart />
            </GameBarButton>
            <LiveStats />
        </>
    );
};

export default LiveStatsButton;
