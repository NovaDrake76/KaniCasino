import Skeleton from "react-loading-skeleton";
import Avatar from "../../../components/Avatar";
import Monetary from "../../../components/Monetary";
import Title from "../../../components/Title";
import PageMeta from "../../../components/PageMeta";
import { rarityColor } from "../../../utils/rarity";
import { LobbyTable } from "../../../services/poker/PokerService";
import { LobbyServices } from "./Lobby.types";
import i18n from "../../../i18n";

// the hook that pulls a browsing player into a seat: a legendary one call away from
// changing hands, named and priced, on the card itself
const AtRiskBanner = ({ table }: { table: LobbyTable }) => {
  if (!table.topAtRisk) return null;
  const color = rarityColor(table.topAtRisk.rarity);
  return (
    <div className="notched-sm p-[2px]" style={{ backgroundColor: color }}>
      <div className="notched-sm flex items-center gap-2 bg-[#19172d] px-2 py-1.5">
        <img src={table.topAtRisk.image} alt="" className="h-8 w-8 object-contain" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-white">{table.topAtRisk.name}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
            {i18n.t("poker.onTheLine")}
          </div>
        </div>
        <Monetary value={table.topAtRisk.value} />
      </div>
    </div>
  );
};

const SeatDots = ({ table }: { table: LobbyTable }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: table.seatCount }, (_, i) => {
      const player = table.players.find((p) => p.seat === i);
      return player ? (
        <div key={i} className="h-6 w-6" title={player.username}>
          <Avatar image={player.profilePicture} id="" size="small" level={0} noLink />
        </div>
      ) : (
        <div key={i} className="notched-xs h-6 w-6 bg-[#19172d]" />
      );
    })}
  </div>
);

const TableCard = ({ table, onOpen }: { table: LobbyTable; onOpen: () => void }) => (
  <button
    onClick={onOpen}
    className="notched flex flex-col gap-3 bg-[#212031] p-4 text-left transition-all hover:bg-[#281D3F]"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold text-white">{table.name}</h3>
        <p className="text-xs text-[#84819A]">
          {i18n.t("poker.blindsLabel")} <Monetary value={table.smallBlind} /> /{" "}
          <Monetary value={table.bigBlind} />
        </p>
      </div>
      <span
        className={`notched-xs shrink-0 px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
          table.seated >= table.seatCount
            ? "bg-[#3A365A] text-[#84819A]"
            : table.seated >= 2
            ? "bg-green-700 text-white"
            : "bg-[#3A365A] text-[#C9C6DE]"
        }`}
      >
        {table.seated}/{table.seatCount}
      </span>
    </div>

    <SeatDots table={table} />
    <AtRiskBanner table={table} />

    <div className="flex items-center justify-between text-xs text-[#84819A]">
      <span>
        {i18n.t("poker.buyInRange")} <Monetary value={table.minBuyIn} /> - <Monetary value={table.maxBuyIn} />
      </span>
      {table.poolCount > 0 && (
        <span className="font-semibold text-[#C9C6DE]">
          {i18n.t("poker.itemsInPlay", { count: table.poolCount })}
        </span>
      )}
    </div>
  </button>
);

const Lobby = ({ tables, loading, open }: LobbyServices) => (
  <div className="flex w-full flex-col items-center gap-6 p-4 md:p-8">
    <PageMeta />
    <Title title={i18n.t("poker.title")} />
    <p className="max-w-2xl text-center text-sm text-[#84819A]">{i18n.t("poker.blurb")}</p>

    <div className="grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loading
        ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={190} />)
        : tables.map((table) => (
            <TableCard key={table._id} table={table} onOpen={() => open(table.slug)} />
          ))}
    </div>

    {!loading && !tables.length && (
      <p className="text-sm text-[#84819A]">{i18n.t("poker.noTables")}</p>
    )}
  </div>
);

export default Lobby;
