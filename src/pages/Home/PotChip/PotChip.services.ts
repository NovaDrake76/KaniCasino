import { useHomePot } from "../HomeFeed/HomeFeed.context";
import i18n from "../../../i18n";

// the lottery tile's jackpot, off the pot the home page reads once and keeps live (HomeFeed)
export const usePotChip = () => {
  const { pot } = useHomePot();
  return { pot: pot ? { label: i18n.t("lottery.jackpot"), jackpot: pot.jackpot } : null };
};
