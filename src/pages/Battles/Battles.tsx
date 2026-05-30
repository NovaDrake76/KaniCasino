import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AiOutlineClose } from "react-icons/ai";
import UserContext from "../../UserContext";
import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import Avatar from "../../components/Avatar";
import { getCases } from "../../services/cases/CaseServices";
import {
  listBattles,
  createBattle,
  getSocket,
  Battle,
  MODE_SLOTS,
} from "../../services/battles/BattleService";

const MODES = ["1v1", "1v1v1", "1v1v1v1", "2v2"];

const Battles = () => {
  const { isLogged, toogleUserFlow } = useContext(UserContext);
  const [cases, setCases] = useState<any[]>([]);
  const [pick, setPick] = useState<string>("");
  const [selected, setSelected] = useState<any[]>([]);
  const [mode, setMode] = useState<string>("1v1");
  const [bakaMode, setBakaMode] = useState<boolean>(false);
  const [waiting, setWaiting] = useState<Battle[]>([]);
  const [creating, setCreating] = useState<boolean>(false);
  const navigate = useNavigate();
  const socket = getSocket();

  useEffect(() => {
    getCases().then((d) => {
      setCases(d || []);
      if (d && d.length) setPick(d[0]._id);
    });
    listBattles().then((b) => setWaiting(b || []));
    const onList = (b: Battle[]) => setWaiting(b || []);
    socket.on("battle:list", onList);
    return () => {
      socket.off("battle:list", onList);
    };
  }, []);

  const entryCost = selected.reduce((s, c) => s + (c.price || 0), 0);

  const addCase = () => {
    const c = cases.find((x) => x._id === pick);
    if (c) setSelected((prev) => [...prev, c]);
  };

  const create = async () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }
    if (!selected.length) {
      toast.error("Add at least one case", { theme: "dark" });
      return;
    }
    setCreating(true);
    const res = await createBattle({ caseIds: selected.map((c) => c._id), mode, bakaMode });
    setCreating(false);
    if (res.error) {
      toast.error(res.error, { theme: "dark" });
      return;
    }
    if (res.id) navigate(`/battles/${res.id}`);
  };

  const selectClass = "bg-[#19172D] border border-gray-700 rounded px-2 py-2 text-sm focus:outline-none";

  return (
    <div className="w-screen flex flex-col items-center py-8 gap-8">
      <Title title="Case Battles" />

      <div className="flex flex-col gap-4 bg-[#212031] rounded p-6 w-full max-w-[560px]">
        <span className="font-bold text-lg">Create a battle</span>

        <div className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Case
            <select className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
              {cases.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title} (K₽{c.price})
                </option>
              ))}
            </select>
          </label>
          <button onClick={addCase} className="px-4 py-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] font-semibold">
            Add
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {selected.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-[#19172D] rounded px-3 py-1 text-sm">
                <div className="flex items-center gap-2">
                  <img src={c.image} alt={c.title} className="w-6 h-6 object-contain" />
                  <span>{c.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Monetary value={c.price} />
                  <AiOutlineClose
                    className="cursor-pointer text-gray-400 hover:text-red-400"
                    onClick={() => setSelected((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex flex-col gap-1 text-sm">
            Mode
            <select className={selectClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm mt-5 cursor-pointer">
            <input type="checkbox" checked={bakaMode} onChange={(e) => setBakaMode(e.target.checked)} />
            Baka mode (lowest total wins)
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-gray-700 pt-3">
          <span className="text-sm text-[#84819a]">
            {selected.length} case{selected.length === 1 ? "" : "s"} · {MODE_SLOTS[mode]} players
          </span>
          <span className="font-bold flex items-center gap-1">
            Entry <Monetary value={entryCost} />
          </span>
        </div>

        <button
          onClick={create}
          disabled={creating || !selected.length}
          className="p-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create battle"}
        </button>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[820px]">
        <span className="font-bold text-lg">Open battles</span>
        {waiting.length === 0 ? (
          <span className="text-[#84819a]">No open battles. Create one.</span>
        ) : (
          waiting.map((b) => (
            <div
              key={b.id}
              onClick={() => navigate(`/battles/${b.id}`)}
              className="flex items-center justify-between bg-[#212031] hover:bg-[#2a2840] cursor-pointer rounded p-4"
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm">
                  {b.mode}{b.bakaMode ? " · baka" : ""} · {b.cases.length} case{b.cases.length === 1 ? "" : "s"}
                </span>
                <span className="text-[#84819a] text-xs flex items-center gap-1">
                  Entry <Monetary value={b.entryCost} /> · {b.players.length}/{MODE_SLOTS[b.mode]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {b.players.map((p) => (
                    <Avatar key={p.slot} image={p.profilePicture} id={p.userId || p.username} size="small" level={0} />
                  ))}
                </div>
                <span className="px-4 py-2 rounded bg-indigo-600 font-semibold text-sm">View</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Battles;
