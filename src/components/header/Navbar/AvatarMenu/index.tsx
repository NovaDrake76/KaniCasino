import { useAvatarMenu } from "./AvatarMenu.services";
import { AvatarMenuProps } from "./AvatarMenu.types";
import AvatarMenuView from "./AvatarMenu.view";

const AvatarMenu = (props: AvatarMenuProps) => {
  const service = useAvatarMenu(props);
  return <AvatarMenuView {...service} />;
};

export default AvatarMenu;
