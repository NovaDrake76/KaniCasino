import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import UserContext from "../../../UserContext";
import { getBoard, getMyStanding, FanBoard, MyStanding } from "../../../services/fandom/FandomService";
import { fixItem } from "../../../services/users/UserServices";
import { toast } from "react-toastify";
import { rarityColor, rarityName } from "../../../utils/rarity";
import { ChaseRow } from "./FandomBoard.types";
import i18n from "../../../i18n";

export const useFandomBoardServices = () => {
  const { name = "" } = useParams();
  const { userData, isLogged } = useContext(UserContext);
  const [board, setBoard] = useState<FanBoard | null>(null);
  const [standing, setStanding] = useState<MyStanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setMissing(false);
    getBoard(name)
      .then((data) => live && setBoard(data))
      .catch(() => live && setMissing(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    if (!isLogged) {
      setStanding(null);
      return;
    }
    let live = true;
    getMyStanding(name)
      .then((data) => live && setStanding(data))
      .catch(() => live && setStanding(null));
    return () => {
      live = false;
    };
  }, [name, isLogged]);

  const reload = useCallback(async () => {
    const [next, standingNext] = await Promise.all([getBoard(name), getMyStanding(name)]);
    setBoard(next);
    setStanding(standingNext);
  }, [name]);

  // pinning from here saves a trip to the inventory, which is where the character was
  // going to be pinned from anyway
  const pin = async () => {
    if (pinning || !standing || !standing.itemId) return;
    setPinning(true);
    try {
      await fixItem(standing.itemId);
      await reload();
      toast.success(i18n.t("fandom.pinned", { name }), { theme: "dark" });
    } catch {
      toast.error(i18n.t("fandom.couldNotPin"), { theme: "dark" });
    }
    setPinning(false);
  };

  const myId = userData?.id ? String(userData.id) : null;
  const leaderCount = board ? board.topCount : 0;

  const rows: ChaseRow[] = useMemo(
    () =>
      (board?.ranks || []).slice(1).map((fan, index) => ({
        rank: index + 2,
        userId: String(fan.userId),
        username: fan.username,
        profilePicture: fan.profilePicture,
        level: fan.level,
        count: fan.count,
        gap: i18n.t("fandom.behindCount", { count: leaderCount - fan.count }),
        me: myId === String(fan.userId),
      })),
    [board, myId, leaderCount]
  );

  const holder = board && board.topCount > 0 ? board.top : null;
  const iHold = !!(holder && myId && String(holder.userId) === myId);

  return {
    name,
    loading,
    missing,
    board,
    color: board ? rarityColor(board.rarity) : "#ffffff",
    rarityLabel: board ? rarityName(board.rarity) : "",
    holder,
    iHold,
    rows,
    mine: standing ? standing.mine : null,
    behind: standing ? standing.behind : 0,
    isLogged,
    pinnedHere: !!standing && standing.pinned,
    pinnedName: standing ? standing.pinnedName : null,
    canPin: !!(standing && standing.itemId && !standing.pinned),
    pinning,
    pin,
    myId,
  };
};
