import { Tooltip } from "react-tooltip";
import { lazy, Suspense, useMemo, useState } from "react";
import Countdown from "../../components/Countdown";
import FixedItem from "./FixedItem";
import FanStanding from "./FanStanding";
import Badge from "../../components/Badge";
import BadgeShelf from "./BadgeShelf";
import AvatarPicker from "./AvatarPicker";
import Avatar from "../../components/Avatar";
import { User } from '../../components/Types'
// the card renderer and its display faces are dead weight until someone opens the sheet
const ShareCard = lazy(() => import("../../components/fanCard/ShareCard"));
import { canShareCard, cardFromStanding } from "../../components/fanCard/cardData";
import { levelProgress, xpForLevel } from "../../utils/levelCurve";
import i18n from "../../i18n";

interface UserProps {
  user: User;
  isSameUser: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

const UserInfo: React.FC<UserProps> = ({
  user: { id, profilePicture, level, username, xp, fixedItem, nextBonus, fanRank, collectionRank, badge, badges, selectedBadge },
  isSameUser,
  setRefresh,
}) => {

  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [sharing, setSharing] = useState(false);
  const card = useMemo(
    () => (canShareCard(fanRank) ? cardFromStanding(fanRank, username, level, fixedItem?.description || "") : null),
    [fanRank, username, level, fixedItem]
  );

  const nextLevelXp = xpForLevel(level + 1);
  const filled = Math.round(levelProgress(xp, level) * 100);


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
                  width: `${filled}%`,
                }}
              />{" "}
              <div
                className={`h-1 bg-[#3a365a] rounded rounded-r-none -translate-x-1 z-0`}
                style={{
                  width: `${100 - filled}%`,
                }}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-[#dddcfc] font-semibold">
                {`XP ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(xp)} / 
    ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(nextLevelXp)
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
        {fixedItem?.name && <FixedItem fixedItem={fixedItem} isSameUser={isSameUser} setRefresh={setRefresh} />}
        <FanStanding
          fanRank={fanRank}
          collectionRank={collectionRank}
          onShare={isSameUser && card ? () => setSharing(true) : undefined}
        />
      </div>
      {sharing && card && (
        <Suspense fallback={null}>
          <ShareCard data={card} leadsABoard={fanRank?.rank === 1} onClose={() => setSharing(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default UserInfo;
