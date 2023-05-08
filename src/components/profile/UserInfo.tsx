interface UserProps {
  user: {
    id: number;
    username: string;
    profilePicture: string;
    level: number;
    xp: number;
  };
}

const getPercentX = (x: number, y: number) => {
  return Math.round((x / y) * 100);
};

const getPercentY = (x: number, y: number) => {
  const xPercent = getPercentX(x, y);

  return 100 - xPercent;
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

          <div className="absolute text-base font-semibold top-28 left-28 rounded-full bg-blue-500 min-w-[24px] h-6 flex justify-center items-center ">
            {level}
          </div>
        </div>
        <div className="flex flex-col w-[686px]">
          <span className="text-2xl font-semibold color-[#dddcfc]">
            {username}
          </span>
          <div className="flex flex-col gap-2 mt-5">
            <div className="flex w-full">
              <div
                className={`h-1 bg-blue-400 rounded rounded-l-none z-10`}
                style={{
                  width: `${getPercentX(xp - level * 1000, 1000)}%`,
                }}
              />{" "}
              <div
                className={`h-1 bg-[#3a365a] rounded rounded-r-none -translate-x-1 z-0`}
                style={{
                  width: `${getPercentY(xp - level * 1000, 1000)}%`,
                }}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-[#dddcfc] font-semibold">{`XP ${xp} / ${
                (level + 1) * 1000
              }`}</span>
              <span className="text-[#3a365a] underline -translate-x-1">
                How XP works?
              </span>
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
