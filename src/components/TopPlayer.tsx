import { User } from '../components/Types';
import Player from './Player';
import Monetary from './Monetary';

interface CardProps {
    user: User;
    rank: number;
}

const TopPlayer: React.FC<CardProps> = ({ user, rank }) => {

    return (
        <div className={`relative w-64 ${rank === 1 ? '-mt-10' : 'invisible md:visible'}`}>
            <div className='relative  z-50 flex flex-col items-center justify-center'>
                <Player user={user} size="large" direction='column' showLevel={false} />
                <div className='flex flex-col items-center gap-2'>
                    <span className='text-2xl font-bold mt-1'>
                        #{rank}
                    </span>
                </div>
                <div className="text-gray-500 truncate mt-6">
                    <Monetary value={user.weeklyWinnings} />
                </div>
            </div>
            <img src="images/podium.svg" alt="podium" className="absolute top-[70px] z-0" />
        </div>
    );
};


export default TopPlayer;