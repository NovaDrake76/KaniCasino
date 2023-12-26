import { User } from '../components/Types';
import Player from './Player';

interface CardProps {
    user: User;
    rank: number;
}

const TopPlayer: React.FC<CardProps> = ({ user, rank }) => {
    return (
        <div className="bg-primary-light shadow-lg rounded-lg p-4 text-center w-64 flex flex-col gap-4 "
            style={{ border: rank === 1 ? '1px solid gold' : rank === 2 ? '1px solid silver' : rank === 3 ? '1px solid #cd7f32' : 'none' }}
        >
            {/* <div className="text-2xl font-bold text-indigo-600">#{rank}</div> */}
            <Player user={user} size="medium" />
            <p className="text-gray-500 truncate">
                {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "DOL",
                    maximumFractionDigits: 0,
                })
                    .format(user.weeklyWinnings)
                    .replace("DOL", "K₽")}
            </p>
        </div>
    );
};


export default TopPlayer;