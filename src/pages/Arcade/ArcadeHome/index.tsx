import { useArcadeHome } from "./ArcadeHome.services";
import ArcadeHomeView from "./ArcadeHome.view";

const ArcadeHome = () => {
  const service = useArcadeHome();
  return <ArcadeHomeView {...service} />;
};

export default ArcadeHome;
