import { useEffect, useState } from 'react';
import { getTopPlayers } from '../../services/users/UserServices';
import { User } from '../../components/Types';
import Title from '../../components/Title';
import TopPlayer from '../../components/TopPlayer';
import Player from '../../components/Player';
import Skeleton from 'react-loading-skeleton';
import i18n from "../../i18n";

// `aside` sits beside the ranked table, below the podium, and drops under everything
// once there is no room for it
const Leaderboard = ({ aside }: { aside?: React.ReactNode }) => {
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
            <Title title={i18n.t("home.leaderboard")} />

            <div className="grid w-full max-w-[1620px] gap-8 px-4 lg:grid-cols-[340px_minmax(0,1fr)_340px]">
            <div className="flex flex-col items-center lg:col-start-2 lg:row-start-1">

            {/* the podium reads three entries, so two ranked players used to crash the page */}
            {!loading && users.length >= 3 ? (
                <div className="flex gap-4 md:gap-6 xl:gap-14 my-16">
                    <TopPlayer key={users[1]._id} user={users[1]} rank={2} />
                    <TopPlayer key={users[0]._id} user={users[0]} rank={1} />
                    <TopPlayer key={users[2]._id} user={users[2]} rank={3} />
                </div>
            ) : (
                <div className="h-[330px]">
                    {/* put a skeleton here */}
                </div>
            )}

            </div>

            <div className="w-full min-w-0 overflow-x-auto lg:col-start-2 lg:row-start-2">
                <table className="min-w-full divide-y divide-gray-500">
                    <thead className="bg-[#19172d]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {i18n.t("home.rank")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {i18n.t("home.name")}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {i18n.t("home.winnings")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className=" divide-y divide-[#19172d]">
                        {loading && <tr><td colSpan={3}>
                            <Skeleton count={10} height={72} />
                        </td></tr>}

                        {!loading && users.slice(3).map((user, index) => (
                            <tr key={user._id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    #{index + 4}
                                </td>

                                <td className="flex p-4 items-center gap-2">
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

            {aside && <div className="w-full lg:col-start-3 lg:row-start-2">{aside}</div>}
            </div>
        </div>
    );
};

export default Leaderboard;
