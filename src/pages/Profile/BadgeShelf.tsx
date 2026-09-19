import { useContext, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import Badge, { badgeName } from "../../components/Badge";
import BadgeCatalog from "./BadgeCatalog";
import { Badge as BadgeData, BadgeKey, setWornBadge } from "../../services/badges/BadgeService";
import i18n from "../../i18n";

interface BadgeShelfProps {
  badges?: BadgeData[];
  selectedBadge?: BadgeKey | null;
  isSameUser: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

// every badge the player holds, with the one they wear around the site marked. clicking
// the worn one takes it off, because a player who wants none should not have to hold one.
const BadgeShelf: React.FC<BadgeShelfProps> = ({ badges, selectedBadge, isSameUser, setRefresh }) => {
  const { userData, toogleUserData } = useContext(UserContext);
  const [worn, setWorn] = useState<BadgeKey | null>(selectedBadge || null);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const held = badges || [];

  const choose = async (key: BadgeKey) => {
    if (!isSameUser || saving) return;
    const next = worn === key ? null : key;
    setSaving(true);
    try {
      const result = await setWornBadge(next);
      setWorn(result.selectedBadge);
      if (userData) toogleUserData({ ...userData, badge: result.badge, selectedBadge: result.selectedBadge });
      // the header reads the badge off the fetched profile, not off the context
      setRefresh && setRefresh((prev) => !prev);
    } catch {
      toast.error(i18n.t("badge.couldNotSave"), { theme: "dark" });
    }
    setSaving(false);
  };

  return (
    <div className="mt-5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#625F7E]">
          {i18n.t("badge.shelfTitle").toUpperCase()}
        </p>
        <button
          onClick={() => setShowAll(true)}
          className="border-0 bg-transparent p-0 text-[11px] font-semibold text-[#84819A] underline outline-none transition-all hover:text-white"
        >
          {i18n.t("badge.seeAll")}
        </button>
      </div>

      {held.length === 0 ? (
        <p className="text-[11px] text-[#625F7E]">
          {isSameUser ? i18n.t("badge.noneYours") : i18n.t("badge.noneTheirs")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {held.map((badge) => (
              <button
                key={badge.key}
                onClick={() => choose(badge.key)}
                disabled={!isSameUser || saving}
                className={`notched-sm flex items-center gap-2 border-0 px-3 py-2 text-xs font-semibold outline-none transition-all ${
                  worn === badge.key ? "bg-[#4F46E5] text-white" : "bg-[#212031] text-[#C9C6DE]"
                } ${isSameUser ? "hover:text-white" : "cursor-default"}`}
              >
                <Badge badge={badge} linked={false} />
                {badgeName(badge.key, badge.label)}
              </button>
            ))}
          </div>
          {isSameUser && (
            <p className="text-[11px] text-[#625F7E]">
              {worn ? i18n.t("badge.clearHint") : i18n.t("badge.chooseHint")}
            </p>
          )}
        </>
      )}

      <BadgeCatalog badges={held} worn={worn} open={showAll} setOpen={setShowAll} />
    </div>
  );
};

export default BadgeShelf;
