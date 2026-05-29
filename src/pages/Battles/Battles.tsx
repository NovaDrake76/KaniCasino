import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import SocketConnection from "../../services/socket";
import UserContext from "../../UserContext";
import { getCases } from "../../services/cases/CaseServices";
import Avatar from "../../components/Avatar";
import Title from "../../components/Title";
import Rarities from "../../components/Rarities";

const socket = SocketConnection.getInstance();

interface BattlePlayer {
  id: string;
  username: string;
  profilePicture: string;
  level: number;
  items: any[];
  score: number;
}

interface Battle {
  id: string;
  caseId: string;
  caseImage: string;
  caseTitle: string;
  price: number;
  maxPlayers: number;
  status: string;
  winnerId: string | null;
  players: BattlePlayer[];
}

const Battles = () => {
  const { isLogged, userData, toogleUserFlow } = useContext(UserContext);

  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [waiting, setWaiting] = useState<Battle[]>([]);
  const [active, setActive] = useState<Battle | null>(null);

  useEffect(() => {
    getCases().then((data) => {
      setCases(data || []);
      if (data && data.length > 0) setSelectedCase(data[0]._id);
    });

    socket.emit("battle:list", (list: Battle[]) => setWaiting(list || []));

    const listListener = (list: Battle[]) => setWaiting(list || []);
    const updatedListener = (battle: Battle) => {
      setActive((prev) => (prev && prev.id === battle.id ? battle : prev));
    };

    socket.on("battle:list", listListener);
    socket.on("battle:updated", updatedListener);

    return () => {
      socket.off("battle:list", listListener);
      socket.off("battle:updated", updatedListener);
    };
  }, []);

  const requireLogin = () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!requireLogin()) return;
    if (!selectedCase) return;

    socket.emit(
      "battle:create",
      { caseId: selectedCase, maxPlayers },
      (res: { id?: string; error?: string }) => {
        if (res?.error) {
          toast.error(res.error, { theme: "dark" });
          return;
        }
        if (res?.id) {
          socket.emit("battle:get", res.id, (battle: Battle) => setActive(battle));
        }
      }
    );
  };

  const handleJoin = (battleId: string) => {
    if (!requireLogin()) return;

    socket.emit("battle:join", battleId, (res: { id?: string; error?: string }) => {
      if (res?.error) {
        toast.error(res.error, { theme: "dark" });
        return;
      }
      socket.emit("battle:get", battleId, (battle: Battle) => setActive(battle));
    });
  };

  const handleLeave = () => {
    if (active && active.status === "waiting") {
      socket.emit("battle:leave", active.id);
    }
    setActive(null);
  };

  const rarityColor = (rarity: number | string) =>
    Rarities.find((r) => r.id.toString() === rarity?.toString())?.color || "#ffffff";

  const renderPlayerSlot = (player: BattlePlayer | null, index: number) => {
    const isWinner = active?.status === "finished" && player && active.winnerId === player.id;
    return (
      <div
        key={index}
        className={`flex flex-col items-center gap-3 bg-[#212031] rounded p-4 w-56 min-h-[260px] border-2 ${
          isWinner ? "border-yellow-400" : "border-transparent"
        }`}
      >
        {player ? (
          <>
            <Avatar image={player.profilePicture} id={player.id} size="small" level={player.level} />
            <span className="font-bold text-sm truncate max-w-[180px]">{player.username}</span>
            {active?.status === "finished" ? (
              <div className="flex flex-col items-center gap-2">
                {player.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center rounded p-2"
                    style={{ boxShadow: `0 0 12px ${rarityColor(item.rarity)}` }}
                  >
                    <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" />
                    <span className="text-xs">{item.name}</span>
                  </div>
                ))}
                {isWinner && <span className="text-yellow-400 font-bold">Winner</span>}
              </div>
            ) : (
              <span className="text-[#84819a] text-sm">Ready</span>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#56528b]">
            <span className="text-4xl">+</span>
            <span className="text-sm">Waiting...</span>
          </div>
        )}
      </div>
    );
  };

  if (active) {
    const slots: (BattlePlayer | null)[] = [];
    for (let i = 0; i < active.maxPlayers; i++) {
      slots.push(active.players[i] || null);
    }

    return (
      <div className="w-screen flex flex-col items-center py-8 gap-6">
        <div className="flex items-center gap-4">
          <img src={active.caseImage} alt={active.caseTitle} className="w-16 h-16 object-contain" />
          <div className="flex flex-col">
            <span className="font-bold text-lg">{active.caseTitle}</span>
            <span className="text-[#84819a] text-sm">K₽{active.price} entry</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          {slots.map((p, i) => renderPlayerSlot(p, i))}
        </div>

        <button
          onClick={handleLeave}
          className="px-4 py-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] font-semibold"
        >
          {active.status === "waiting" ? "Leave battle" : "Back to battles"}
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen flex flex-col items-center py-8 gap-8">
      <Title title="Case Battles" />

      <div className="flex flex-col gap-4 bg-[#212031] rounded p-6 w-full max-w-[480px]">
        <span className="font-bold text-lg">Create a battle</span>
        <label className="flex flex-col gap-1 text-sm">
          Case
          <select
            className="p-2 rounded bg-[#19172D] border border-gray-700"
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
          >
            {cases.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title} (K₽{c.price})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Players
          <select
            className="p-2 rounded bg-[#19172D] border border-gray-700"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={handleCreate}
          className="p-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
        >
          Create battle
        </button>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[820px]">
        <span className="font-bold text-lg">Open battles</span>
        {waiting.length === 0 ? (
          <span className="text-[#84819a]">No open battles. Create one!</span>
        ) : (
          waiting.map((battle) => (
            <div
              key={battle.id}
              className="flex items-center justify-between bg-[#212031] rounded p-4"
            >
              <div className="flex items-center gap-3">
                <img src={battle.caseImage} alt={battle.caseTitle} className="w-12 h-12 object-contain" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{battle.caseTitle}</span>
                  <span className="text-[#84819a] text-xs">
                    {battle.players.length}/{battle.maxPlayers} · K₽{battle.price}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {battle.players.map((p) => (
                    <Avatar key={p.id} image={p.profilePicture} id={p.id} size="small" level={p.level} />
                  ))}
                </div>
                {userData && battle.players.some((p) => p.id === userData.id) ? (
                  <button
                    onClick={() => socket.emit("battle:get", battle.id, (b: Battle) => setActive(b))}
                    className="px-4 py-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] font-semibold"
                  >
                    View
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(battle.id)}
                    className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
                  >
                    Join
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Battles;
