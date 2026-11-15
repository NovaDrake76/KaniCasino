import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { FiArrowDown, FiChevronRight, FiClock } from "react-icons/fi";
import Monetary from "../../../components/Monetary";
import Clock from "./Clock";
import { BallsIcon, CupIcon } from "./TodayIcons";
import { CardData, TodayCard, TodayStripViewProps, YouChip } from "./TodayStrip.types";

const CARD =
  "flex min-w-0 flex-col justify-center gap-1 rounded-lg bg-surface p-3 text-ink transition-all hover:bg-surface-hover hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light md:h-[88px] md:flex-row md:items-center md:justify-start md:gap-4 md:px-5 md:py-0 md:shadow-[0_12px_28px_rgba(7,5,18,0.55)]";

const CHIP = "shrink-0 rounded bg-surface-raised px-1.5 text-[11px] font-bold normal-case leading-4 tracking-[0.02em] text-ink-soft md:px-2";

const Pending = ({ phone, desktop }: { phone: [number, number]; desktop: [number, number] }) => (
  <>
    <Skeleton inline width={phone[0]} height={phone[1]} containerClassName="flex md:hidden" containerTestId="today-pending" />
    <Skeleton inline width={desktop[0]} height={desktop[1]} containerClassName="hidden md:flex" containerTestId="today-pending" />
  </>
);

const Name = ({ name, you }: { name: string; you: string | null }) => (
  <span className="flex min-w-0 items-center gap-2">
    <span className="min-w-0 break-words hyphens-auto text-[10px] font-bold uppercase leading-[14px] tracking-[0.1em] text-ink-muted md:text-[11px] md:leading-4 md:tracking-[0.12em]">
      {name}
    </span>
    {you && <span className={`hidden md:inline-block ${CHIP}`}>{you}</span>}
  </span>
);

const Amount = ({ data }: { data: CardData }) => (
  <span
    data-testid="today-amount"
    className="flex h-6 items-center whitespace-nowrap text-xl font-extrabold leading-6 tabular-nums text-accent-gold md:h-[29px] md:text-[26px] md:leading-[29px]"
  >
    {data.kind === "ready" && <Monetary value={data.amount} />}
    {data.kind === "empty" && <span className="text-ink-faint">-</span>}
    {data.kind === "loading" && <Pending phone={[92, 18]} desktop={[132, 24]} />}
  </span>
);

const ClockRow = ({ data, you }: { data: CardData; you: string | null }) => (
  <span className="flex h-4 min-w-0 flex-wrap items-center gap-x-[5px] overflow-hidden text-xs font-bold leading-4 tabular-nums text-ink-soft md:h-7 md:shrink-0 md:flex-nowrap md:gap-2 md:overflow-visible md:text-xl md:font-extrabold md:leading-7 md:text-ink">
    {data.kind !== "empty" && <FiClock aria-hidden="true" className="h-[13px] w-[13px] shrink-0 text-ink-faint md:h-[18px] md:w-[18px]" />}
    {data.kind === "ready" && <Clock endsAt={data.endsAt} skew={data.skew} />}
    {data.kind === "loading" && <Pending phone={[56, 10]} desktop={[96, 18]} />}
    {you && <span className={`ml-auto md:hidden ${CHIP}`}>{you}</span>}
  </span>
);

const CardBody = ({ card, icon, arrow, you = null }: { card: TodayCard; icon: React.ReactNode; arrow: React.ReactNode; you?: YouChip | null }) => (
  <>
    <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-raised lg:grid">{icon}</span>
    <span className="flex min-w-0 flex-col gap-1 md:flex-1 md:gap-[3px]">
      <Name name={card.name} you={you && you.full} />
      <Amount data={card.data} />
    </span>
    <ClockRow data={card.data} you={you && you.short} />
    {arrow}
  </>
);

const ARROW = "hidden h-5 w-5 shrink-0 text-ink-faint lg:block";

const TodayStripView: React.FC<TodayStripViewProps> = ({ lottery, leaderboard, you, lotteryTo, leaderboardHref, goToLeaderboard }) => (
  <div data-testid="today-strip" className="relative z-raised mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-3 px-4 pb-3 md:-mt-11 md:gap-4 md:pb-4">
    <Link to={lotteryTo} data-testid="today-lottery" className={CARD}>
      <CardBody card={lottery} icon={<BallsIcon />} arrow={<FiChevronRight aria-hidden="true" className={ARROW} />} />
    </Link>
    <a href={leaderboardHref} onClick={goToLeaderboard} data-testid="today-leaderboard" className={CARD}>
      <CardBody card={leaderboard} icon={<CupIcon />} arrow={<FiArrowDown aria-hidden="true" className={ARROW} />} you={you} />
    </a>
  </div>
);

export default TodayStripView;
