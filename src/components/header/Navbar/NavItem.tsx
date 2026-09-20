import { Link } from "react-router-dom";
import { NavLink } from "../gameLinks";
import NavFlare from "./NavFlare";

interface NavItemProps {
  link: NavLink;
  active: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ link, active }) => (
  <Link
    to={link.path}
    title={link.name}
    onClick={link.onClick}
    aria-current={active ? "page" : undefined}
    className="group relative flex shrink-0 cursor-pointer items-center gap-2 text-xs font-normal 2xl:text-sm"
  >
    <NavFlare active={active} />
    <span className={`relative transition-colors ${active ? "text-white" : "text-[#625F7E] group-hover:text-gray-200"}`}>
      {link.icon}
    </span>
    <span
      className={`nav-label relative whitespace-nowrap transition-colors ${
        active ? "text-white" : "text-ink-soft group-hover:text-white"
      }`}
    >
      {link.name}
    </span>
    {link.badge}
  </Link>
);

export default NavItem;
