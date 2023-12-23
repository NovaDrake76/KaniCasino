import { useEffect, useState } from 'react';
import { getTopPlayers } from '../../services/users/UserServices';
import { User } from '../../components/Types';
import Title from '../../components/Title';
import TopPlayer from '../../components/TopPlayer';
import Player from '../../components/Player';

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
        <div className="flex flex-col items-center justify-center ">
            <Title title="Weekly Leaderboard" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                {users.slice(0, 3).map((user, index) => (
                    <TopPlayer key={user._id} user={user} rank={index + 1} />
                ))}
            </div>

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
                        {loading && <tr><td colSpan={3}>Loading...</td></tr>}
                        {users.slice(3).map((user, index) => (
                            <tr key={user._id}>
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
