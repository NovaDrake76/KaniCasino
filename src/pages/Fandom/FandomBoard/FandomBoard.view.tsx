import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Avatar from "../../../components/Avatar";
import { FandomBoardViewProps } from "./FandomBoard.types";
import { BsHeartFill, BsInfoCircle } from "react-icons/bs";
import i18n from "../../../i18n";

const CROWN = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFCC00" className="absolute -top-2 -right-2">
    <path d="M3 8l4.5 3.5L12 4l4.5 7.5L21 8l-1.6 10.4a1 1 0 0 1-1 .85H5.6a1 1 0 0 1-1-.85z" />
  </svg>
);

const FandomBoardView: React.FC<FandomBoardViewProps> = ({
  name,
  loading,
  missing,
  board,
  color,
  rarityLabel,
  holder,
  iHold,
  rows,
  mine,
  behind,
  isLogged,
  pinnedHere,
  pinnedName,
  canPin,
  pinning,
  pin,
  myId,
}) => {
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1000px] px-4 py-10">
        <Skeleton height={220} />
        <Skeleton count={6} height={56} className="mt-2" />
      </div>
    );
  }

  if (missing || !board) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-lg font-semibold">{i18n.t("fandom.noSuchCharacter")}</p>
        <Link to="/fandom" className="notched-sm bg-[#4F46E5] px-6 py-2 text-xs font-bold text-white">
          {i18n.t("fandom.allCharacters")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 pb-20 pt-6">
      <Link to="/fandom" className="text-xs font-semibold text-[#84819A] hover:text-white">
        &larr; {i18n.t("fandom.allCharacters")}
      </Link>

      <div className="mt-5 flex flex-col gap-5 md:flex-row">
        <div className="notched shrink-0 bg-[#212031] p-1">
          <div
            className="flex h-[196px] w-full items-center justify-center bg-[#19172d] md:w-[196px]"
            style={{ borderBottom: `4px solid ${color}` }}
          >
            <img src={board.image} alt={name} className="h-full w-full object-contain p-2" />
          </div>
        </div>

        <div className="notched flex flex-1 flex-col justify-center gap-4 bg-[#212031] px-6 py-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-extrabold">{name}</h1>
            <span className="text-xs font-bold tracking-widest" style={{ color }}>
              {rarityLabel.toUpperCase()}
            </span>
          </div>

          {holder ? (
            <div className="flex items-center gap-4">
              <Link to={`/profile/${holder.userId}`} className="relative shrink-0">
                <Avatar id={holder.userId} image={holder.profilePicture} size="medium" level={holder.level} noLink />
                {CROWN}
              </Link>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold tracking-widest text-[#FFCC00]">
                  {i18n.t("fandom.topFan")}
                </p>
                <Link to={`/profile/${holder.userId}`} className="block truncate text-xl font-bold hover:underline">
                  {holder.username}
                </Link>
                <p className="text-xs text-[#84819A]">
                  {i18n.t("fandom.holdingSince", {
                    date: new Date(holder.since).toLocaleDateString(),
                  })}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-5xl font-extrabold leading-none text-[#FFCC00]">{board.topCount}</p>
                <p className="mt-1 text-[11px] text-[#84819A]">{i18n.t("fandom.copies")}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="notched-sm flex h-14 w-14 items-center justify-center border border-dashed border-[#3A365A]">
                <BsHeartFill className="text-xl text-[#625F7E]" />
              </span>
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-[#ECA823]">
                  {i18n.t("fandom.nobodyYet")}
                </p>
                <p className="text-sm text-[#C9C6DE]">{i18n.t("fandom.oneIsEnough")}</p>
              </div>
            </div>
          )}

          <div className="h-px bg-[#2A2840]" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#C9C6DE]">
              {board.fanCount === 0
                ? i18n.t("fandom.noFansYet")
                : i18n.t(board.fanCount === 1 ? "fandom.peoplePinnedOne" : "fandom.peoplePinned", {
                    count: board.fanCount,
                    name,
                  })}
            </p>
            <Link
              to={board.caseId ? `/case/${board.caseId}` : "/"}
              className="notched-sm bg-[#4F46E5] px-5 py-2.5 text-xs font-bold text-white"
            >
              {i18n.t("fandom.openCasesWith", { name })}
            </Link>
          </div>
        </div>
      </div>

      <div className="notched mt-6 bg-[#212031] px-6 py-5">
        <p className="mb-4 text-[10px] font-extrabold tracking-widest text-[#84819A]">
          {i18n.t("fandom.theChase")}
        </p>

        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-[#84819A]">{i18n.t("fandom.noChasers")}</p>
        )}

        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <Link
              to={`/profile/${row.userId}`}
              key={row.userId}
              className={`notched-sm flex items-center gap-4 px-4 py-3 transition-all ${
                row.me ? "bg-[#281D3F]" : "bg-[#19172d] hover:bg-[#241f38]"
              }`}
            >
              <span className={`w-8 text-sm font-extrabold ${row.me ? "text-[#ECA823]" : "text-[#625F7E]"}`}>
                #{row.rank}
              </span>
              <Avatar id={row.userId} image={row.profilePicture} size="small" level={row.level} noLink />
              <span className={`truncate text-sm font-semibold ${row.me ? "text-[#ECA823]" : ""}`}>
                {row.username}
              </span>
              <span className="ml-auto flex items-center gap-5">
                <span className="hidden text-[11px] text-[#84819A] sm:inline">{row.gap}</span>
                <span className={`w-12 text-right text-lg font-extrabold ${row.me ? "text-[#ECA823]" : "text-[#C9C6DE]"}`}>
                  {row.count}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {isLogged && mine !== null && !iHold && (
          <div className="notched-sm mt-5 flex flex-wrap items-center gap-4 bg-[#281D3F] px-4 py-3.5">
            <img
              src={board.image}
              alt={name}
              className="notched-sm h-10 w-10 shrink-0 bg-[#212031] object-cover"
              style={{ borderBottom: `3px solid ${color}` }}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-bold">{i18n.t("fandom.youHave", { count: mine, name })}</p>
              <p className="text-[11px] text-[#84819A]">
                {pinnedHere
                  ? i18n.t("fandom.needMore", { count: behind })
                  : pinnedName
                  ? i18n.t("fandom.pinnedElsewhere", { name: pinnedName })
                  : i18n.t("fandom.pinToJoin")}
              </p>
            </div>
            {canPin ? (
              <button
                onClick={pin}
                disabled={pinning}
                className="notched-sm ml-auto bg-[#4F46E5] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {pinnedName ? i18n.t("fandom.pinInstead", { name }) : i18n.t("fandom.pinThis", { name })}
              </button>
            ) : (
              <Link
                to={board.caseId ? `/case/${board.caseId}` : `/profile/${myId}?tab=inventory`}
                className="notched-sm ml-auto bg-[#212031] px-4 py-2.5 text-xs font-bold text-[#C9C6DE] hover:text-white"
              >
                {i18n.t("fandom.openMoreCases")}
              </Link>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <BsInfoCircle className="shrink-0 text-[#84819A]" />
          <p className="text-[11px] text-[#84819A]">{i18n.t("fandom.marketNote")}</p>
        </div>
      </div>
    </div>
  );
};

export default FandomBoardView;
