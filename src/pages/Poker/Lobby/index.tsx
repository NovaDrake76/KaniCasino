import LobbyView from "./Lobby.view";
import { useLobbyServices } from "./Lobby.services";

const PokerLobby = () => {
  const service = useLobbyServices();
  return <LobbyView {...service} />;
};

export default PokerLobby;
