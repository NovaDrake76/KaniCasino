import { Tooltip } from "react-tooltip";
import { useState } from "react";
import Countdown from "../../components/Countdown";
import FixedItem from "./FixedItem";
import FanStanding from "./FanStanding";
import Badge from "../../components/Badge";
import BadgeShelf from "./BadgeShelf";
import AvatarPicker from "./AvatarPicker";
import Avatar from "../../components/Avatar";
import { User } from '../../components/Types'
import i18n from "../../i18n";

interface UserProps {
  user: User;
  isSameUser: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

const getPercentX = (x: number, y: number) => {
  return Math.round((x / y) * 100);
};

const getPercentY = (x: number, y: number) => {
  const xPercent = getPercentX(x, y);

  return 100 - xPercent;
};

const UserInfo: React.FC<UserProps> = ({
  user: { id, profilePicture, level, username, xp, fixedItem, nextBonus, fanRank, collectionRank, badge, badges, selectedBadge },
  isSameUser,
  setRefresh,
}) => {

  const [pickingAvatar, setPickingAvatar] = useState(false);

  const calculateRequiredXP = (level: number) => {
    const baseXP = 1000;
    let requiredXP = baseXP;
    for (let i = 1; i <= level; i++) {
      requiredXP += baseXP * Math.pow(1.25, i - 1);
    }
    requiredXP = Math.round(requiredXP);

    return requiredXP;
  };


  return (
    <div className="flex flex-col lg:flex-row items-center justify-between w-full">
      <div className="flex flex-col lg:flex-row items-center gap-7">
        <div className="relative group">
          <Avatar image={profilePicture} loading={false} id={id} size={'extra-large'} level={level} showLevel={true} noLink={true} />

          {isSameUser && (
            <button
              className="absolute inset-0 w-full h-full opacity-0 hover:opacity-70 bg-blue-500 transition-all flex items-center justify-center rounded-full cursor-pointer group-hover:opacity-70"
              onClick={() => setPickingAvatar(true)}
            >
              <span className="text-white text-sm px-2 text-center">{i18n.t("profile.avatarChange")}</span>
            </button>
          )}
          {isSameUser && (
            <AvatarPicker
              open={pickingAvatar}
              setOpen={setPickingAvatar}
              onPicked={() => setRefresh && setRefresh(true)}
            />
          )}
        </div>
        <div className="flex flex-col w-80 md:w-[686px]">
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-2 text-2xl font-semibold color-[#dddcfc]">
              {username}
              <Badge badge={badge} size="large" />
            </span>
            {
              nextBonus && new Date(nextBonus).getTime() > Date.now() && (
                <Countdown nextBonus={nextBonus} />
              )
            }

          </div>
          <div className="flex flex-col gap-2 mt-5">
            <div className="flex w-full">
              <div
                className={`h-1 bg-blue-400 rounded rounded-l-none z-10`}
                style={{
                  width: `${getPercentX(xp, calculateRequiredXP(level))}%`,
                }}
              />{" "}
              <div
                className={`h-1 bg-[#3a365a] rounded rounded-r-none -translate-x-1 z-0`}
                style={{
                  width: `${getPercentY(xp, calculateRequiredXP(level))}%`,
                }}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-[#dddcfc] font-semibold">
                {`XP ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(xp)} / 
    ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(calculateRequiredXP(level))
                  }`}
              </span>
              <Tooltip id="my-tooltip" />

              <span
                className="text-[#3a365a] underline -translate-x-1 cursor-help"
                data-tooltip-id="my-tooltip"
                data-tooltip-content={i18n.t("profile.toEvery1kSpent")}
              >
                {i18n.t("profile.howXpWorks")}
              </span>
            </div>
          </div>
          <BadgeShelf badges={badges} selectedBadge={selectedBadge} isSameUser={isSameUser} setRefresh={setRefresh} />
        </div>
      </div>
      <div className="mt-4 md:mt-0">
        {fixedItem && <FixedItem fixedItem={fixedItem} isSameUser={isSameUser} setRefresh={setRefresh} />}
        <FanStanding fanRank={fanRank} collectionRank={collectionRank} />
      </div>
    </div>
  );
};

export default UserInfo;
