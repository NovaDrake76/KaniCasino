import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Title from "../../../components/Title";
import Avatar from "../../../components/Avatar";
import Pagination from "../../../components/Pagination";
import { FandomViewProps } from "./Fandom.types";
import { FiSearch } from "react-icons/fi";
import { BsHeart, BsHeartFill } from "react-icons/bs";
import i18n from "../../../i18n";

const FandomView: React.FC<FandomViewProps> = ({
  tab,
  tabs,
  selectTab,
  search,
  setSearch,
  loading,
  cards,
  reachCards,
  collectors,
  characterCount,
  page,
  totalPages,
  goToPage,
  isLogged,
  signIn,
}) => (
  <div className="flex flex-col items-center w-full px-4 pb-20">
    <Title title={i18n.t("fandom.title")} />

    <p className="max-w-[640px] text-center text-sm leading-relaxed text-[#C9C6DE]">
      {i18n.t("fandom.intro")}{" "}
      <span className="text-[#84819A]">{i18n.t("fandom.introTail")}</span>
    </p>

    <div className="mt-8 flex w-full max-w-[1240px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            className={`notched-sm px-4 py-2 text-xs font-semibold transition-all ${
              tab === key ? "bg-[#4F46E5] text-white" : "bg-[#212031] text-[#C9C6DE] hover:text-white"
            }`}
          >
            {i18n.t(`fandom.tab.${key}`)}
          </button>
        ))}
      </div>

      {tab !== "collectors" && tab !== "reach" && (
        <div className="notched-sm flex min-w-[210px] items-center gap-2 border border-[#2A2840] bg-[#19172d] px-3 py-2">
          <FiSearch className="text-[#625F7E]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={i18n.t("fandom.searchPlaceholder")}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#625F7E]"
          />
        </div>
      )}
    </div>

    {loading && (
      <div className="mt-6 w-full max-w-[1240px]">
        <Skeleton count={4} height={220} />
      </div>
    )}

    {!loading && tab === "reach" && !isLogged && (
      <div className="notched mt-10 flex flex-col items-center gap-4 bg-[#212031] px-10 py-12">
        <BsHeart className="text-3xl text-[#4F46E5]" />
        <p className="text-sm text-[#C9C6DE]">{i18n.t("fandom.reachSignedOut")}</p>
        <button onClick={signIn} className="notched-sm bg-[#4F46E5] px-6 py-2 text-xs font-bold text-white">
          {i18n.t("fandom.signIn")}
        </button>
      </div>
    )}

    {!loading && tab === "reach" && isLogged && (
      <div className="mt-6 grid w-full max-w-[1240px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reachCards.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-[#84819A]">
            {i18n.t("fandom.reachEmpty")}
          </p>
        )}
        {reachCards.map((row) => (
          <Link
            to={`/fandom/${encodeURIComponent(row.name)}`}
            key={row.name}
            className="notched-sm flex flex-col gap-3 bg-[#19172d] p-4 transition-all hover:bg-[#212031]"
          >
            <div className="flex items-center gap-3">
              <img
                src={row.image}
                alt={row.name}
                className="notched-sm h-11 w-11 shrink-0 bg-[#212031] object-cover"
                style={{ borderBottom: `3px solid ${row.color}` }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{row.name}</p>
                <p className="truncate text-[11px] text-[#84819A]">{row.standing}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-extrabold leading-none text-[#ECA823]">{row.headline}</p>
                <p className="text-[9px] font-bold tracking-widest text-[#84819A]">{row.headlineLabel}</p>
              </div>
            </div>

            <div>
              <div className="flex h-[5px] bg-[#2A2840]">
                <div className="bg-[#ECA823]" style={{ width: `${row.pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[#625F7E]">
                <span>{i18n.t("fandom.youHaveShort", { count: row.mine })}</span>
                <span>{i18n.t("fandom.toBeat", { count: row.leader })}</span>
              </div>
            </div>

            <div
              className={`notched-sm py-2.5 text-center text-xs font-bold ${
                row.claimable ? "bg-[#4F46E5] text-white" : "bg-[#281D3F] text-[#C9C6DE]"
              }`}
            >
              {row.claimable ? i18n.t("fandom.claimIt", { name: row.name }) : i18n.t("fandom.seeTheBoard")}
            </div>
          </Link>
        ))}
      </div>
    )}

    {!loading && tab === "collectors" && (
      <div className="notched mt-6 w-full max-w-[820px] bg-[#212031] p-5">
        <p className="mb-4 text-xs text-[#84819A]">
          {i18n.t("fandom.collectorsIntro", { count: characterCount })}
        </p>
        <div className="flex flex-col gap-2">
          {collectors.map((row, index) => (
            <Link
              to={`/profile/${row.userId}`}
              key={row.userId}
              className="notched-sm flex items-center gap-4 bg-[#19172d] px-4 py-3 transition-all hover:bg-[#281D3F]"
            >
              <span className="w-8 text-sm font-extrabold text-[#625F7E]">#{index + 1}</span>
              <Avatar id={row.userId} image={row.profilePicture} size="small" level={row.level} noLink />
              <span className="truncate text-sm font-semibold">{row.username}</span>
              <span className="ml-auto text-right">
                <span className="block text-lg font-extrabold leading-none text-[#FFCC00]">{row.distinct}</span>
                <span className="text-[10px] text-[#84819A]">
                  {i18n.t("fandom.ofCharacters", { count: characterCount })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    )}

    {!loading && (tab === "contested" || tab === "biggest" || tab === "open") && (
      <>
        <div className="mt-6 grid w-full max-w-[1240px] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-[#84819A]">
              {i18n.t("fandom.noneFound")}
            </p>
          )}
          {cards.map((card) => (
            <Link
              to={`/fandom/${encodeURIComponent(card.name)}`}
              key={card.name}
              className="notched flex flex-col bg-[#212031] transition-all hover:bg-[#281D3F]"
            >
              <div
                className="relative flex h-[172px] items-center justify-center bg-[#19172d]"
                style={{ borderBottom: `4px solid ${card.color}` }}
              >
                <img src={card.image} alt={card.name} className="h-full w-full object-contain p-2" />
                {card.contested && (
                  <span className="notched-sm absolute left-2.5 top-2.5 bg-[#ECA823] px-2 py-1 text-[9px] font-extrabold tracking-widest text-[#2a2100]">
                    {i18n.t("fandom.contested")}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold">{card.name}</p>
                  <p className="shrink-0 text-[10px] font-semibold text-[#625F7E]">{card.fansLabel}</p>
                </div>

                <div className="h-px bg-[#2A2840]" />

                {card.holder ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar id={card.holderId || ""} image={card.holderPicture} size="small" level={0} noLink />
                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold tracking-widest text-[#FFCC00]">
                        {i18n.t("fandom.topFan")}
                      </p>
                      <p className="truncate text-[13px] font-semibold">{card.holder}</p>
                    </div>
                    <p className="ml-auto text-xl font-extrabold leading-none text-[#FFCC00]">{card.count}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="notched-sm flex h-9 w-9 shrink-0 items-center justify-center border border-dashed border-[#3A365A]">
                      <BsHeartFill className="text-[#625F7E]" />
                    </span>
                    <div>
                      <p className="text-[9px] font-extrabold tracking-widest text-[#ECA823]">
                        {i18n.t("fandom.nobodyYet")}
                      </p>
                      <p className="text-[13px] font-semibold text-[#C9C6DE]">{i18n.t("fandom.oneIsEnough")}</p>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination totalPages={totalPages} currentPage={page} setPage={goToPage} />
          </div>
        )}
      </>
    )}
  </div>
);

export default FandomView;
