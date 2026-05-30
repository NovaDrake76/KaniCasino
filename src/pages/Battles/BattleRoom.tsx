import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import Monetary from "../../components/Monetary";
import Avatar from "../../components/Avatar";
import Rarities from "../../components/Rarities";
import {
  getBattle,
  joinBattle,
  startBattle,
  addBot,
  kickPlayer,
  leaveBattle,
  getSocket,
  Battle,
  BattlePlayer,
  MODE_SLOTS,
} from "../../services/battles/BattleService";

const rarityColor = (r: string | number) =>
  Rarities.find((x) => x.id.toString() === String(r))?.color || "#ffffff";

const BattleRoom = () => {
  const { id = "" } = useParams();
  const { userData, isLogged, toogleUserFlow } = useContext(UserContext);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const socket = getSocket();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    getBattle(id).then((b) => {
      if (active) {
        setBattle(b);
        setLoading(false);
      }
    });

    const onState = (b: Battle) => {
      if (b.id === id) setBattle(b);
    };
    const onRound = (data: { battleId: string; round: number; players: BattlePlayer[] }) => {
      if (data.battleId !== id) return;
      setBattle((prev) =>
        prev ? { ...prev, players: data.players, currentRound: data.round + 1, status: "in_progress" } : prev
      );
    };
    const onFinished = (b: Battle) => {
      if (b.id === id) setBattle(b);
    };

    socket.on("battle:state", onState);
    socket.on("battle:round", onRound);
    socket.on("battle:finished", onFinished);
    return () => {
      active = false;
      socket.off("battle:state", onState);
      socket.off("battle:round", onRound);
      socket.off("battle:finished", onFinished);
    };
  }, [id]);

  if (loading) return <div className="w-screen py-16 text-center">Loading battle...</div>;
  if (!battle) return <div className="w-screen py-16 text-center">Battle not found.</div>;

  const slots = MODE_SLOTS[battle.mode] || battle.players.length;
  const myId = userData?.id;
  const isHost = !!myId && battle.createdBy === myId;
  const inBattle = !!battle.players.find((p) => p.userId && p.userId === myId);
  const full = battle.players.length >= slots;
  const playerAt = (slot: number) => battle.players.find((p) => p.slot === slot);
  const isWinner = (p: BattlePlayer) => !!p.userId && battle.winnerUserIds.includes(p.userId);

  const doJoin = async () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }
    const res = await joinBattle(id);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doStart = async () => {
    const res = await startBattle(id);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doAddBot = async () => {
    const res = await addBot(id);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doKick = async (slot: number) => {
    const res = await kickPlayer(id, slot);
    if (res.error) toast.error(res.error, { theme: "dark" });
  };
  const doLeave = () => {
    leaveBattle(id);
    navigate("/battles");
  };
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Invite link copied", { theme: "dark" });
  };

  return (
    <div className="w-screen flex flex-col items-center py-8 gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="font-bold text-xl">
          {battle.mode}
          {battle.bakaMode ? " · baka mode" : ""}
        </span>
        <span className="text-[#84819a] text-sm flex items-center gap-1">
          {battle.cases.length} case{battle.cases.length === 1 ? "" : "s"} · entry <Monetary value={battle.entryCost} />
          {battle.status === "in_progress" &&
            ` · opening ${Math.min(battle.currentRound + 1, battle.cases.length)}/${battle.cases.length}`}
        </span>
      </div>

      {battle.status === "waiting" && (
        <button onClick={copyLink} className="text-sm border-b border-gray-500 text-gray-400 hover:text-white">
          Copy invite link
        </button>
      )}

      <div className="flex flex-wrap gap-4 justify-center w-full max-w-[1200px]">
        {Array.from({ length: slots }).map((_, slot) => {
          const p = playerAt(slot);
          return (
            <div
              key={slot}
              className={`flex flex-col items-center gap-2 bg-[#212031] rounded p-4 w-56 min-h-[320px] border-2 ${
                p && isWinner(p) ? "border-yellow-400" : "border-transparent"
              }`}
            >
              {p ? (
                <>
                  <div className="flex items-center gap-2">
                    <Avatar image={p.profilePicture} id={p.userId || p.username} size="small" level={0} />
                    <span className="font-bold text-sm truncate max-w-[110px]">{p.username}</span>
                    {p.isBot && <span className="text-[10px] bg-[#19172D] px-1 rounded">BOT</span>}
                  </div>

                  {battle.status !== "waiting" && (
                    <span className="font-bold text-green-400 flex items-center gap-1">
                      <Monetary value={p.total} />
                    </span>
                  )}

                  <div className="flex flex-col items-center gap-2 w-full">
                    {p.items.map((it, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 w-full rounded p-1 bg-[#19172D] ${
                          i === p.items.length - 1 ? "animate-fade-in" : ""
                        }`}
                        style={{ boxShadow: `inset 0 -2px 0 ${rarityColor(it.rarity)}` }}
                      >
                        <img src={it.image} alt={it.name} className="w-10 h-10 object-contain" />
                        <div className="flex flex-col text-xs overflow-hidden">
                          <span className="truncate">{it.name}</span>
                          <span className="text-green-400">
                            <Monetary value={it.baseValue || 0} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {battle.status === "waiting" && isHost && slot !== 0 && (
                    <button onClick={() => doKick(slot)} className="text-xs text-red-400 hover:text-red-300 mt-auto">
                      Kick
                    </button>
                  )}
                  {battle.status === "finished" && isWinner(p) && (
                    <span className="text-yellow-400 font-bold mt-auto">Winner</span>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-[#56528b]">
                  <span>Empty slot</span>
                  {battle.status === "waiting" && !inBattle && (
                    <button onClick={doJoin} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                      Join
                    </button>
                  )}
                  {battle.status === "waiting" && isHost && (
                    <button onClick={doAddBot} className="px-3 py-1 rounded bg-[#281D3F] hover:bg-[#3a2c5c] text-white text-sm">
                      Add bot
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        {battle.status === "waiting" && isHost && (
          <button
            onClick={doStart}
            disabled={!full}
            className="px-6 py-2 rounded bg-green-700 hover:bg-green-600 font-semibold disabled:opacity-50"
          >
            {full ? "Start battle" : `Waiting for players (${battle.players.length}/${slots})`}
          </button>
        )}
        {battle.status === "waiting" && inBattle && (
          <button onClick={doLeave} className="px-4 py-2 rounded bg-[#281D3F] hover:bg-red-700 font-semibold">
            {isHost ? "Cancel battle" : "Leave"}
          </button>
        )}
        {battle.status === "cancelled" && <span className="text-red-400">This battle was cancelled.</span>}
        {(battle.status === "finished" || battle.status === "in_progress") && (
          <button onClick={() => navigate("/battles")} className="px-4 py-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] font-semibold">
            Back to battles
          </button>
        )}
      </div>
    </div>
  );
};

export default BattleRoom;
