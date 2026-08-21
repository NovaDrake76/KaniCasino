import { LobbyTable } from "../../../services/poker/PokerService";

export interface LobbyServices {
  tables: LobbyTable[];
  loading: boolean;
  isLogged: boolean;
  open: (slug: string) => void;
  signIn: () => void;
}
