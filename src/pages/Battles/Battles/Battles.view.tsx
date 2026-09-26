import { AiOutlineArrowLeft, AiOutlineClose } from "react-icons/ai";
import Title from "../../../components/Title";
import Monetary from "../../../components/Monetary";
import Avatar from "../../../components/Avatar";
import { BattlesViewProps, CaseInfo } from "./Battles.types";
import type { CaseGroup } from "../../Home/groupCases";
import i18n from "../../../i18n";

const CaseButton = ({ item, count, onAdd }: { item: CaseInfo; count: number; onAdd: (c: CaseInfo) => void }) => (
  <button
    onClick={() => onAdd(item)}
    title={i18n.t("battles.addCase", { case: item.title })}
    className="relative flex flex-col items-center w-36 rounded-lg bg-[#212031] hover:bg-[#2a2840] p-3 transition-all border-2 border-transparent hover:border-indigo-500"
  >
    {count > 0 && (
      <span className="absolute top-1 right-1 bg-indigo-600 rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-bold">
        {count}
      </span>
    )}
    <img src={item.image} alt={item.title} className="w-24 h-24 object-cover" />
    <span className="text-sm font-semibold text-center truncate w-full mt-1">{item.title}</span>
    <span className="text-green-400 text-sm">
      <Monetary value={item.price} />
    </span>
  </button>
);

// a whole category as one card, the way the daily gift offers its collections: open it to pick from its cases
const CategoryCard = ({ group, picked, onOpen }: { group: CaseGroup; picked: number; onOpen: (category: string) => void }) => {
  const prices = group.cases.map((c) => c.price || 0);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return (
    <button
      onClick={() => onOpen(group.category)}
      className="relative flex flex-col gap-3 rounded-lg bg-[#212031] hover:bg-[#2a2840] p-4 text-left transition-all border-2 border-transparent hover:border-indigo-500"
    >
      {picked > 0 && (
        <span className="absolute top-2 right-2 bg-indigo-600 rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-bold">
          {picked}
        </span>
      )}
      <div className="flex h-20 items-center justify-center -space-x-6">
        {group.cases.slice(-3).map((c) => (
          <img key={c._id} src={c.image} alt="" className="h-20 w-20 object-contain" loading="lazy" />
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-bold truncate">{group.category}</span>
        <span className="text-xs text-[#84819a]">{i18n.t("battles.categoryCases", { count: group.cases.length })}</span>
        <span className="text-xs text-green-400 flex items-center gap-1">
          <Monetary value={low} />
          {high > low && (
            <>
              {" - "}
              <Monetary value={high} />
            </>
          )}
        </span>
      </div>
    </button>
  );
};

const BattlesView: React.FC<BattlesViewProps> = ({
  modes,
  groups,
  openCategory,
  openGroup,
  closeGroup,
  shownCases,
  searching,
  pickedIn,
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
  <div className="w-full flex flex-col items-center py-8 gap-8 px-4">
    <Title title={i18n.t("nav.caseBattles")} />

    <div className="flex flex-col gap-4 w-full max-w-[1100px] bg-[#212031] rounded-lg p-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-[#84819a]">
          {i18n.t("battles.selectedCases", { count: selected.length })}
        </span>
        {selected.length === 0 ? (
          <div className="text-[#56528b] text-sm py-3">
            {i18n.t("battles.clickCasesBelowTo")}
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
              {i18n.t("battles.bakaMode")}
            </span>
            Flips the win condition: the player or team with the{" "}
            <span className="text-white font-semibold">{i18n.t("battles.lowest")}</span> total value
            wins the pot instead of the highest. Bad luck pays off.
          </div>
        </div>
        {selected.length > 0 && (
          <button
            onClick={clearSelected}
            className="text-xs text-gray-400 hover:text-white ml-auto"
          >
            {i18n.t("battles.clear")}
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
          data-tour="battle-create"
          className="px-6 py-2.5 rounded bg-green-700 hover:bg-green-600 font-semibold disabled:opacity-50"
        >
          {creating ? "Creating..." : i18n.t("battles.createBattle")}
        </button>
      </div>
    </div>

    <div className="flex flex-col gap-3 w-full max-w-[1100px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="font-bold text-lg">{i18n.t("battles.pickCases")}</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.t("battles.searchCases")}
          className="bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded px-3 py-1.5 text-sm w-full sm:w-64 transition-all"
        />
      </div>
      {loadingCases ? (
        <span className="text-[#84819a] py-6 text-center">{i18n.t("battles.loadingCases")}</span>
      ) : searching || openCategory ? (
        <div className="flex flex-col gap-3">
          {!searching && (
            <div className="flex items-center gap-3 text-sm">
              <button onClick={closeGroup} className="flex items-center gap-1.5 text-[#84819a] hover:text-white transition-colors">
                <AiOutlineArrowLeft /> {i18n.t("battles.allCategories")}
              </button>
              <span className="text-[#56528b]">/</span>
              <span className="font-semibold">{openCategory}</span>
            </div>
          )}
          {shownCases.length === 0 ? (
            <span className="text-[#84819a] py-6 text-center">
              {searching ? i18n.t("battles.noCasesMatch", { search }) : i18n.t("battles.noCasesAvailable")}
            </span>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              {shownCases.map((c) => (
                <CaseButton key={c._id} item={c} count={countOf(c._id)} onAdd={addCase} />
              ))}
            </div>
          )}
        </div>
      ) : groups.length === 0 ? (
        <span className="text-[#84819a] py-6 text-center">{i18n.t("battles.noCasesAvailable")}</span>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {groups.map((g) => (
            <CategoryCard key={g.id} group={g} picked={pickedIn(g.category)} onOpen={openGroup} />
          ))}
        </div>
      )}
    </div>

    <div className="flex flex-col gap-2 w-full max-w-[1100px]">
      <span className="font-bold text-lg">{i18n.t("battles.openBattles")}</span>
      {waiting.length === 0 ? (
        <span className="text-[#84819a]">{i18n.t("battles.noOpenBattlesYet")}</span>
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
                    id={p.userId || ""}
                    size="small"
                    level={0}
                    noLink
                  />
                ))}
              </div>
              <span className="px-4 py-2 rounded bg-indigo-600 font-semibold text-sm">
                {i18n.t("battles.view")}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default BattlesView;
