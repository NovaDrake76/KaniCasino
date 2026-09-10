import { useDaisu } from "./Daisu.services";
import DaisuDockView from "./DaisuDock.view";
import "./daisu.css";

const DaisuDock = () => {
  const service = useDaisu();
  return <DaisuDockView {...service} />;
};

export default DaisuDock;
