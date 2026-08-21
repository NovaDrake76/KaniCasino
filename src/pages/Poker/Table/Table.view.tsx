import { useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Monetary from "../../../components/Monetary";
import PageMeta from "../../../components/PageMeta";
import UserContext from "../../../UserContext";
import { useIsWide } from "../../../hooks/useMediaQuery";
import Seat from "../components/Seat";
import Board from "../components/Board";
import ActionRail from "../components/ActionRail";
import BuyInModal from "../components/BuyInModal";
import CashOutModal from "../components/CashOutModal";
import { PokerSeat } from "../../../services/poker/PokerService";
import { ShowdownSummary, TableServices } from "./Table.types";
import i18n from "../../../i18n";

const ACTION_SECONDS = 25;

// six seats around an ellipse, hero at the bottom. the order is already rotated by the
// service, so index 0 here is always the viewer's own chair.
const RING = [
  { bottom: "0", left: "50%", translate: "-50%, 0" },
  { bottom: "22%", left: "0", translate: "0, 0" },
  { top: "20%", left: "0", translate: "0, 0" },
  { top: "0", left: "50%", translate: "-50%, 0" },
  { top: "20%", right: "0", translate: "0, 0" },
  { bottom: "22%", right: "0", translate: "0, 0" },
];

const Feed = ({ entries }: { entries: TableServices["feed"] }) => (
  <div className="pointer-events-none flex min-h-[24px] flex-wrap items-center justify-center gap-1.5">
    <AnimatePresence>
      {entries.slice(-3).map((entry) => (
        <motion.span
          key={entry.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="notched-xs bg-[#19172d]/80 px-2 py-0.5 text-[10px] font-semibold text-[#C9C6DE]"
        >
          {entry.username} {i18n.t(`poker.did_${entry.action}`)}
          {entry.to ? ` ${entry.to}` : ""}
          {entry.auto ? ` (${i18n.t("poker.timedOut")})` : ""}
        </motion.span>
      ))}
    </AnimatePresence>
  </div>
);

const ShowdownBanner = ({ showdown }: { showdown: ShowdownSummary }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.94 }}
    animate={{ opacity: 1, scale: 1 }}
    className="notched-sm bg-[#4F46E5] px-4 py-2 text-center"
  >
    {showdown.winners.map((w) => (
      <div key={w.seat} className="text-sm font-bold text-white">
        {i18n.t("poker.wins", { name: w.username })} <Monetary value={w.amount} />
        {w.hand ? ` · ${w.hand}` : ""}
      </div>
    ))}
  </motion.div>
);

interface FeltProps {
  table: TableServices["table"];
  liveTotal: number;
  feed: TableServices["feed"];
  showdown: TableServices["showdown"];
}

// the felt is drawn twice: once inside the desktop seat ring and once above the stacked
// phone layout, because six seats around an ellipse cannot fit 360px
const Felt = ({ table, liveTotal, feed, showdown }: FeltProps) =>
  table ? (
    <div className="notched relative aspect-[16/8] w-full bg-[#1b1930] p-[2px]">
      <div className="notched relative h-full w-full bg-gradient-to-b from-[#241f3d] to-[#191630]">
        <div
          className="absolute inset-y-[7%] inset-x-[13%] rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse at center, #322a5c 0%, #221d3e 72%)",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.55), 0 0 40px rgba(79,70,229,0.12)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          <Board
            board={table.board}
            pots={table.pots}
            liveTotal={liveTotal}
            atRisk={table.atRisk}
            handNumber={table.handNumber}
            status={table.status}
          />
          <Feed entries={feed} />
          <AnimatePresence>{showdown && <ShowdownBanner showdown={showdown} />}</AnimatePresence>
        </div>
      </div>
    </div>
  ) : null;

const TableView = (service: TableServices) => {
  const { userData } = useContext(UserContext);
  const wide = useIsWide();
  const {
    table,
    loading,
    error,
    order,
    heroSeat,
    secondsLeft,
    feed,
    showdown,
    atRiskIds,
    buyInSeat,
    openBuyIn,
    closeBuyIn,
    buyInItems,
    buyInLoading,
    submitBuyIn,
    cashOutOpen,
    cashOut,
    openCashOut,
    closeCashOut,
    submitCashOut,
    act,
    acting,
    pool,
  } = service;

  if (loading) {
    return (
      <div className="w-full p-8">
        <Skeleton height={480} />
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="flex w-full flex-col items-center gap-4 p-12">
        <p className="text-sm text-[#84819A]">{error || i18n.t("poker.tableGone")}</p>
        <Link to="/poker" className="text-sm text-[#4F46E5] underline">
          {i18n.t("poker.backToLobby")}
        </Link>
      </div>
    );
  }

  const liveTotal =
    table.seats.reduce((sum, s) => sum + s.totalCommitted, 0) ||
    table.pots.reduce((sum, p) => sum + p.amount, 0);
  const holdingFor = (seat: number) => pool.filter((e) => e.stakedBy === seat);
  const heroSeated = heroSeat !== null;

  const chair = (seatIndex: number, compact = false) => (
    <Seat
      seat={table.seats[seatIndex] as PokerSeat}
      isHero={seatIndex === heroSeat}
      isButton={seatIndex === table.button && table.status !== "idle"}
      isToAct={seatIndex === table.toAct}
      secondsLeft={seatIndex === table.toAct ? secondsLeft : null}
      totalSeconds={ACTION_SECONDS}
      holding={holdingFor(seatIndex)}
      atRiskIds={atRiskIds}
      onSit={() => openBuyIn(seatIndex)}
      compact={compact}
    />
  );

  return (
    <div className="flex w-full flex-col items-center gap-4 p-3 md:p-6">
      <PageMeta />

      <div className="flex w-full max-w-5xl items-center justify-between">
        <div>
          <Link to="/poker" className="text-xs text-[#84819A] underline hover:text-white">
            {i18n.t("poker.backToLobby")}
          </Link>
          <h1 className="text-xl font-bold text-white">{table.name}</h1>
          <p className="text-xs text-[#84819A]">
            {i18n.t("poker.blindsLabel")} <Monetary value={table.smallBlind} /> /{" "}
            <Monetary value={table.bigBlind} />
            {table.handNumber > 0 && ` · ${i18n.t("poker.handNumber", { n: table.handNumber })}`}
          </p>
        </div>
        {heroSeated && (
          <button
            onClick={openCashOut}
            className="notched-sm bg-[#3A365A] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#4a4570]"
          >
            {i18n.t("poker.cashOut")}
          </button>
        )}
      </div>

      {wide ? (
      <div className="relative mx-auto w-full max-w-5xl px-[70px] py-[92px]">
        <Felt table={table} liveTotal={liveTotal} feed={feed} showdown={showdown} />
        {order.map((seatIndex, position) => {
          const spot = RING[position % RING.length];
          return (
            <div
              key={seatIndex}
              className="absolute"
              style={{
                top: spot.top,
                bottom: spot.bottom,
                left: spot.left,
                right: spot.right,
                transform: `translate(${spot.translate})`,
              }}
            >
              {chair(seatIndex)}
            </div>
          );
        })}
      </div>
      ) : (
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex w-full flex-wrap items-start justify-center gap-2">
          {order.slice(1).map((seatIndex) => (
            <div key={seatIndex}>{chair(seatIndex, true)}</div>
          ))}
        </div>
        <div className="notched w-full bg-[#1b1930] p-[2px]">
          <div className="notched relative flex min-h-[190px] w-full items-center justify-center bg-gradient-to-b from-[#241f3d] to-[#191630] px-2 py-4">
            <div className="flex flex-col items-center gap-2">
              <Board
                board={table.board}
                pots={table.pots}
                liveTotal={liveTotal}
                atRisk={table.atRisk}
                handNumber={table.handNumber}
                status={table.status}
              />
              <Feed entries={feed} />
              <AnimatePresence>{showdown && <ShowdownBanner showdown={showdown} />}</AnimatePresence>
            </div>
          </div>
        </div>
        {chair(order[0])}
      </div>
      )}

      <div className="w-full max-w-3xl">
        {heroSeated ? (
          <ActionRail
            legal={table.legal}
            pot={liveTotal}
            bigBlind={table.bigBlind}
            acting={acting}
            onAct={act}
          />
        ) : (
          <div className="notched w-full bg-[#212031] px-4 py-5 text-center text-sm text-[#84819A]">
            {i18n.t("poker.pickASeat")}
          </div>
        )}
      </div>

      <BuyInModal
        open={buyInSeat !== null}
        onClose={closeBuyIn}
        items={buyInItems}
        loading={buyInLoading}
        minBuyIn={table.minBuyIn}
        maxBuyIn={table.maxBuyIn}
        bigBlind={table.bigBlind}
        walletBalance={Math.floor(userData?.walletBalance || 0)}
        onSubmit={submitBuyIn}
      />
      <CashOutModal
        open={cashOutOpen}
        onClose={closeCashOut}
        options={cashOut}
        onSubmit={submitCashOut}
      />
    </div>
  );
};

export default TableView;
