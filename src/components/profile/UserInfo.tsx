interface UserProps {
  user: {
    id: number;
    username: string;
    profilePicture: string;
    level: number;
    xp: number;
  };
}

const getPercent = (x: number, y: number) => {
  return Math.round((x / (x + y)) * 100);
};

const UserInfo: React.FC<UserProps> = ({
  user: { profilePicture, level, username, xp },
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-7">
        <div className="flex relative">
          <img
            src={
              profilePicture
                ? profilePicture
                : "https://i.imgur.com/uUfJSwW.png"
            }
            alt="avatar"
            className="w-36 h-36 rounded-full object-cover border-2 border-blue-500 p-1"
          />

          <div className="absolute top-28 left-28 rounded-full bg-blue-500 min-w-[24px] h-6 flex justify-center items-center ">
            {level}
          </div>
        </div>
        <div className="flex flex-col w-[686px]">
          <span className="text-2xl font-semibold color-[#dddcfc]">
            {username}
          </span>
          <div className="flex flex-col gap-2 mt-5">
            <div className="flex">
              <div
                className={`h-1 bg-blue-400 rounded rounded-r-none`}
                style={{ width: `${getPercent((level + 1) * 1000, xp)}%` }}
              />
              <div
                className={`h-1 bg-[#3a365a] rounded rounded-l-none`}
                style={{ width: `${getPercent(xp, (level + 1) * 1000)}%` }}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-[#dddcfc] font-semibold">{`XP ${xp} / ${
                (level + 1) * 1000
              }`}</span>
              <span className="text-[#3a365a] underline">How XP works?</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex p-4 rounded border border-gray-800 w-80 h-44 bg-gradient-to-tr from-[#161429] to-[#291414] ">
        a
      </div>
    </div>
  );
};

export default UserInfo;
