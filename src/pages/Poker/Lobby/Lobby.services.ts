import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserContext from "../../../UserContext";
import { getLobby, getSocket, LobbyTable } from "../../../services/poker/PokerService";
import { LobbyServices } from "./Lobby.types";

// the lobby is cheap and changes whenever anybody sits down anywhere, so it polls rather
// than holding a subscription to every table at once
const REFRESH_MS = 5000;

export const useLobbyServices = (): LobbyServices => {
  const { isLogged, toogleUserFlow } = useContext(UserContext);
  const navigate = useNavigate();
  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await getLobby();
      if (!live) return;
      if (res && res.tables) setTables(res.tables);
      setLoading(false);
    };

    load();
    const id = setInterval(load, REFRESH_MS);
    const socket = getSocket();
    socket.on("connect", load);
    return () => {
      live = false;
      clearInterval(id);
      socket.off("connect", load);
    };
  }, []);

  return {
    tables,
    loading,
    isLogged,
    open: (slug: string) => navigate(`/poker/${slug}`),
    signIn: () => toogleUserFlow(true),
  };
};
