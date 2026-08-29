import Player from './Player';
import Monetary from './Monetary';
import { BoardStanding } from '../services/leaderboard/LeaderboardService';
import i18n from "../i18n";

interface CardProps {
    user: BoardStanding;
    rank: number;
}

const TopPlayer: React.FC<CardProps> = ({ user, rank }) => {

    return (
        <div className={`relative w-48 md:w-56 xl:w-64 ${rank === 1 ? '-mt-10' : 'hidden md:block'}`}>
            <div className='relative z-raised flex flex-col items-center justify-center'>
                {/* a long username wrapped to a second line and pushed this card's rank
                    below the podium's line while the other two stayed above it. going to
                    block for the ellipsis drops the name row's flex gap, so the badge
                    carries its own margin instead */}
                <div className='w-full [&>div]:w-full [&_a]:block [&_a>div]:w-full [&_a>div>span]:block [&_a>div>span]:max-w-full [&_a>div>span]:truncate [&_a>div>span>*]:mr-2'>
                    <Player user={user as never} size="large" direction='column' showLevel={false} />
                </div>
                <div className='flex flex-col items-center gap-2'>
                    <span className={`text-2xl font-bold mt-1 ${rank === 1 ? 'text-accent-gold' : ''}`}>
                        #{rank}
                    </span>
                </div>
                <div className="flex flex-col items-center mt-6">
                    <span className="text-gray-500 tabular-nums truncate">
                        {new Intl.NumberFormat("en-US").format(user.points)}
                    </span>
                    <span className="text-xs text-gray-500 tracking-wider">
                        {i18n.t("leaderboard.points")}
                    </span>
                    <span className="mt-2 text-xl font-bold text-accent-gold">
                        <Monetary value={user.prize} />
                    </span>
                </div>
            </div>
            <img src="images/podium.svg" alt={i18n.t("common.podium")} className="absolute top-[70px] z-0" />
        </div>
    );
};


export default TopPlayer;
