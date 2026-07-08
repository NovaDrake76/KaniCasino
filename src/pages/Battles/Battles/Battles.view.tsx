import { AiOutlineClose } from "react-icons/ai";
import Title from "../../../components/Title";
import Monetary from "../../../components/Monetary";
import Avatar from "../../../components/Avatar";
import { BattlesViewProps } from "./Battles.types";

const BattlesView: React.FC<BattlesViewProps> = ({
  modes,
  cases,
  selected,
  mode,
  bakaMode,
  search,
  loadingCases,
  waiting,
  creating,
  entryCost,
  currentSlots,
  countOf,
  addCase,
  removeAt,
  clearSelected,
  setMode,
  toggleBaka,
  setSearch,
  create,
  openBattle,
  slotsFor,
}) => (
  <div className="w-screen flex flex-col items-center py-8 gap-8 px-4">
    <Title title="Case Battles" />

    <div className="flex flex-col gap-4 w-full max-w-[1100px] bg-[#212031] rounded-lg p-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-[#84819a]">
          Selected cases ({selected.length})
        </span>
        {selected.length === 0 ? (
          <div className="text-[#56528b] text-sm py-3">
            Click cases below to add them. Click the same case again to add more
            than one.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {selected.map((c, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={c.image}
                  alt={c.title}
                  className="w-16 h-16 object-cover rounded bg-[#19172D]"
                />
                <button
                  onClick={() => removeAt(i)}
                  className="absolute -top-1 -right-1 aspect-square text-white bg-red-600 hover:bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <AiOutlineClose size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-sm font-semibold border transition-all ${
                mode === m
                  ? "bg-indigo-600 border-indigo-500"
                  : "bg-[#19172D] border-gray-700 hover:border-gray-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="relative group">
          <button
            onClick={toggleBaka}
            className={`px-3 py-1.5 rounded text-sm font-semibold border transition-all ${
              bakaMode
                ? "bg-pink-700 border-pink-500"
                : "bg-[#19172D] border-gray-700 hover:border-gray-500"
            }`}
          >
            Baka mode {bakaMode ? "on" : "off"}
          </button>
          <div className="pointer-events-none absolute left-0 bottom-full mb-2 w-64 rounded-lg bg-[#151225] border border-gray-700 p-3 text-xs text-[#c9c6de] shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-30">
            <span className="font-bold text-pink-400 block mb-1">
              Baka mode
            </span>
            Flips the win condition: the player or team with the{" "}
            <span className="text-white font-semibold">lowest</span> total value
            wins the pot instead of the highest. Bad luck pays off.
          </div>
        </div>
        {selected.length > 0 && (
          <button
            onClick={clearSelected}
            className="text-xs text-gray-400 hover:text-white ml-auto"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-700 pt-4 flex-wrap gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-[#84819a]">
            {currentSlots} players{bakaMode ? " · lowest total wins" : ""}
          </span>
          <span className="font-bold flex items-center gap-1 text-lg">
            Entry <Monetary value={entryCost} />
          </span>
        </div>
        <button
          onClick={create}
          disabled={creating || !selected.length}
          className="px-6 py-2.5 rounded bg-green-700 hover:bg-green-600 font-semibold disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create battle"}
        </button>
      </div>
    </div>

    <div className="flex flex-col gap-3 w-full max-w-[1100px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="font-bold text-lg">Pick cases</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cases..."
          className="bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded px-3 py-1.5 text-sm w-full sm:w-64 transition-all"
        />
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        {loadingCases ? (
          <span className="text-[#84819a] py-6">Loading cases...</span>
        ) : cases.length === 0 ? (
          <span className="text-[#84819a] py-6">
            {search ? `No cases match "${search}".` : "No cases available."}
          </span>
        ) : (
          cases.map((c) => (
            <button
              key={c._id}
              onClick={() => addCase(c)}
              title={`Add ${c.title}`}
              className="relative flex flex-col items-center w-36 rounded-lg bg-[#212031] hover:bg-[#2a2840] p-3 transition-all border-2 border-transparent hover:border-indigo-500"
            >
              {countOf(c._id) > 0 && (
                <span className="absolute top-1 right-1 bg-indigo-600 rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-bold">
                  {countOf(c._id)}
                </span>
              )}
              <img
                src={c.image}
                alt={c.title}
                className="w-24 h-24 object-cover"
              />
              <span className="text-sm font-semibold text-center truncate w-full mt-1">
                {c.title}
              </span>
              <span className="text-green-400 text-sm">
                <Monetary value={c.price} />
              </span>
            </button>
          ))
        )}
      </div>
    </div>

    <div className="flex flex-col gap-2 w-full max-w-[1100px]">
      <span className="font-bold text-lg">Open battles</span>
      {waiting.length === 0 ? (
        <span className="text-[#84819a]">No open battles yet.</span>
      ) : (
        waiting.map((b) => (
          <div
            key={b.id}
            onClick={() => openBattle(b.id)}
            className="flex items-center justify-between bg-[#212031] hover:bg-[#2a2840] cursor-pointer rounded p-4"
          >
            <div className="flex flex-col">
              <span className="font-bold text-sm">
                {b.mode}
                {b.bakaMode ? " · baka" : ""} · {b.cases.length} case
                {b.cases.length === 1 ? "" : "s"}
              </span>
              <span className="text-[#84819a] text-xs flex items-center gap-1">
                Entry <Monetary value={b.entryCost} /> · {b.players.length}/
                {slotsFor(b.mode)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {b.players.map((p) => (
                  <Avatar
                    key={p.slot}
                    image={p.profilePicture}
                    id={p.userId || p.username}
                    size="small"
                    level={0}
                  />
                ))}
              </div>
              <span className="px-4 py-2 rounded bg-indigo-600 font-semibold text-sm">
                View
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default BattlesView;
