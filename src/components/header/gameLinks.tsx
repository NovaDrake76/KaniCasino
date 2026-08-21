import { BsCoin, BsSortUp } from "react-icons/bs";
import { GiUpgrade, GiCrossedSwords, GiCardAceSpades, GiMineExplosion, GiPerspectiveDiceSixFacesRandom, GiPokerHand } from "react-icons/gi";
import { SlPlane } from "react-icons/sl";
import { TbCat, TbBounceRight } from "react-icons/tb";
import i18n from "../../i18n";

export interface NavLink {
  name: string;
  path: string;
  icon: JSX.Element;
  badge?: JSX.Element;
}

// one list for the navbar menu and the sidebar, so a new game is added in one place.
// called during render, never at module scope: a name resolved at import would freeze
// whatever language the page opened in.
export const gameLinks = (): NavLink[] => [
  { name: i18n.t("nav.crash"), path: "/crash", icon: <SlPlane className="text-2xl" /> },
  { name: i18n.t("nav.coinFlip"), path: "/coinflip", icon: <BsCoin className="text-2xl" /> },
  { name: i18n.t("nav.slots"), path: "/slot", icon: <TbCat className="text-2xl" /> },
  { name: i18n.t("nav.upgrade"), path: "/upgrade", icon: <GiUpgrade className="text-2xl" /> },
  { name: i18n.t("nav.caseBattles"), path: "/battles", icon: <GiCrossedSwords className="text-2xl" /> },
  { name: i18n.t("nav.plinko"), path: "/plinko", icon: <TbBounceRight className="text-2xl" /> },
  { name: i18n.t("blackjack.blackjack"), path: "/blackjack", icon: <GiCardAceSpades className="text-2xl" /> },
  { name: i18n.t("dice.dice"), path: "/dice", icon: <GiPerspectiveDiceSixFacesRandom className="text-2xl" /> },
  { name: i18n.t("mines.mines"), path: "/mines", icon: <GiMineExplosion className="text-2xl" /> },
  { name: i18n.t("hilo.hilo"), path: "/hilo", icon: <BsSortUp className="text-2xl" /> },
  { name: i18n.t("poker.title"), path: "/poker", icon: <GiPokerHand className="text-2xl" /> },
];
