import { UserRank } from '../components/Types';
import Avatar from '../components/Avatar';

interface CardProps {
    user: UserRank;
    rank: number;
}

const TopPlayer: React.FC<CardProps> = ({ user, rank }) => {
    return (
        <div className="bg-primary-light shadow-lg rounded-lg p-4 text-center w-64 flex flex-col gap-4 "
            style={{ border: rank === 1 ? '1px solid gold' : rank === 2 ? '1px solid silver' : rank === 3 ? '1px solid #cd7f32' : 'none' }}
        >
            {/* <div className="text-2xl font-bold text-indigo-600">#{rank}</div> */}
            <div className='flex items-center justify-center gap-4'>
                <Avatar id={user._id} image={user.profilePicture} size={'medium'} showLevel={true} level={user.level} />
                <span className="mt-2 font-semibold">{user.username}</span>

            </div>
            <p className="text-gray-500">K₽{user.weeklyWinnings}</p>
        </div>
    );
};


export default TopPlayer;