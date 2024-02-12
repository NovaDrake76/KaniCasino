import { useEffect, useState } from 'react';
import { getTopPlayers } from '../../services/users/UserServices';
import { User } from '../../components/Types';
import Title from '../../components/Title';
import TopPlayer from '../../components/TopPlayer';
import Player from '../../components/Player';
import Skeleton from 'react-loading-skeleton';

const Leaderboard = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        getTopPlayers().then(users => {
            setUsers(users);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);



    return (
        <div className="flex flex-col items-center justify-center max-w-[360px] md:max-w-none  z-50 ">
            <Title title="Leaderboard" />

            {!loading && users[1] ? (
                <div className="flex gap-14 my-16 ">
                    <TopPlayer key={users[1].id} user={users[1]} rank={2} />
                    <TopPlayer key={users[0].id} user={users[0]} rank={1} />
                    <TopPlayer key={users[2].id} user={users[2]} rank={3} />
                </div>
            ) : (
                <div className="h-[330px]">
                    {/* put a skeleton here */}
                </div>
            )}

            <div className="w-full overflow-x-auto max-w-4xl">
                <table className="min-w-full divide-y divide-gray-500">
                    <thead className="bg-[#19172d]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rank
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Winnings
                            </th>
                        </tr>
                    </thead>
                    <tbody className=" divide-y divide-[#19172d]">
                        {loading && <tr><td colSpan={3}>
                            <Skeleton count={10} height={72} />
                        </td></tr>}

                        {!loading && users.slice(3).map((user, index) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    #{index + 4}
                                </td>

                                <td className="flex p-4 items-center gap-2"

                                >
                                    <Player user={user} size="small" />

                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {new Intl.NumberFormat("en-US", {
                                        style: "currency",
                                        currency: "DOL",
                                        maximumFractionDigits: 0,
                                    })
                                        .format(user.weeklyWinnings)
                                        .replace("DOL", "K₽")}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Leaderboard;
