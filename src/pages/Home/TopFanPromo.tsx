import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBoards, FanBoardSummary } from "../../services/fandom/FandomService";
import { rarityColor } from "../../utils/rarity";
import i18n from "../../i18n";

const SHOWN = 4;

// the front door to the fan boards: whoever is holding the most contested characters
// right now, and how few copies it would take to take one off them
const TopFanPromo = () => {
  const [boards, setBoards] = useState<FanBoardSummary[]>([]);

  useEffect(() => {
    getBoards("contested", 1, "")
      .then((data) => setBoards(data.boards.slice(0, SHOWN)))
      .catch(() => setBoards([]));
  }, []);

  if (boards.length === 0) return null;

  return (
    <section className="flex w-full flex-col items-center py-6">
      <div className="flex w-full max-w-[1600px] flex-col gap-4 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold uppercase tracking-wide text-white md:text-2xl">
              {i18n.t("fandom.title")}
            </h2>
            <p className="mt-1 text-sm text-[#84819A]">{i18n.t("fandom.promoLine")}</p>
          </div>
          <Link to="/fandom" className="notched-sm bg-[#212031] px-5 py-2.5 text-xs font-bold text-[#C9C6DE] hover:text-white">
            {i18n.t("fandom.seeAllBoards")}
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {boards.map((board) => (
            <Link
              to={`/fandom/${encodeURIComponent(board.name)}`}
              key={board.name}
              className="notched-sm flex items-center gap-3 bg-[#212031] p-3 transition-all hover:bg-[#281D3F]"
            >
              <img
                src={board.image}
                alt={board.name}
                className="notched-sm h-12 w-12 shrink-0 bg-[#19172d] object-contain"
                style={{ borderBottom: `3px solid ${rarityColor(board.rarity)}` }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{board.name}</p>
                <p className="truncate text-[11px] text-[#84819A]">
                  {board.top
                    ? i18n.t("fandom.leaderHolds", { name: board.top.username, count: board.topCount })
                    : i18n.t("fandom.oneIsEnough")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopFanPromo;
