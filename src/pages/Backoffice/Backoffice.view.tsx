import Skeleton from "react-loading-skeleton";
import Avatar from "../../components/Avatar";
import Monetary from "../../components/Monetary";
import {
  AdminOverview,
  AdminGameStats,
  AdminCaseRow,
  AdminUsersPage,
  AdminBigWin,
  AdminPlayerDetail,
  TimeseriesPoint,
} from "../../services/admin/AdminServices";
import { Window } from "./Backoffice.services";
import AdminChart from "./AdminChart";
import { CHART_AMBER, CHART_INDIGO, fillDays } from "./adminSeries";

interface Props {
  userData: any;
  isAdmin: boolean;
  days: Window;
  setDays: (d: Window) => void;
  overview: AdminOverview | null;
  games: AdminGameStats | null;
  cases: AdminCaseRow[] | null;
  series: TimeseriesPoint[] | null;
  wins: AdminBigWin[] | null;
  usersPage: AdminUsersPage | null;
  page: number;
  setPage: (p: number) => void;
  search: string;
  changeSearch: (s: string) => void;
  loading: boolean;
  error: boolean;
  playerId: string | null;
  player: AdminPlayerDetail | null;
  playerLoading: boolean;
  openPlayer: (id: string) => void;
  closePlayer: () => void;
}

const GAME_LABELS: Record<string, string> = {
  crash: "Crash",
  coinflip: "Coin Flip",
  slots: "Slots",
  plinko: "Plinko",
  cases: "Case openings",
  battles: "Case battles",
};

const WIN_LABELS: Record<string, string> = {
  slot_win: "Slots",
  plinko_win: "Plinko",
  crash_cashout: "Crash",
  coinflip_win: "Coin Flip",
};

const LINE_LABELS: Record<string, string> = {
  market_fee: "Market fees",
  item_sell: "Item buybacks",
  bonus: "Claimable bonus",
  signup: "Signup balance",
  mission_reward: "Mission rewards",
  referral_bonus: "Referral bonuses",
  referral_milestone: "Referral milestones",
  referral_commission: "Referral commission",
  ad_reward: "Ad rewards",
  admin_adjust: "Admin adjustments",
};
const label = (type: string) => LINE_LABELS[type] || type.replace(/_/g, " ");

const netClass = (n: number) => (n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-ink-soft");

// KP-paying games can be judged against their designed return; item games cannot
const KP_GAMES = new Set(["crash", "coinflip", "slots", "plinko"]);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const rtpClass = (actual: number, theo: number | null, wagered: number) => {
  if (theo === null || wagered < 10000) return "text-ink-soft";
  if (actual > theo + 0.03) return "text-red-400";
  if (actual < theo - 0.03) return "text-green-400";
  return "text-ink-soft";
};

const StatCard = ({ title, children, sub }: { title: string; children: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="bg-surface rounded-lg p-4 flex flex-col gap-1">
    <span className="text-sm text-ink-muted">{title}</span>
    <span className="text-xl font-semibold text-ink">{children}</span>
    {sub && <span className="text-xs text-ink-muted">{sub}</span>}
  </div>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface rounded-lg p-5">
    <h2 className="text-ink font-semibold mb-3">{title}</h2>
    {children}
  </div>
);

const WINDOWS: { value: Window; text: string }[] = [
  { value: null, text: "All time" },
  { value: 30, text: "30 days" },
  { value: 7, text: "7 days" },
];

const PlayerDetail = ({
  player,
  loading,
  windowText,
  onBack,
}: {
  player: AdminPlayerDetail | null;
  loading: boolean;
  windowText: string;
  onBack: () => void;
}) => {
  if (loading) {
    return <Skeleton height={420} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />;
  }
  if (!player || !player.user || !player.totals) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-ink-muted">
        Could not load this player.
        <button onClick={onBack} className="px-3 py-1.5 rounded-md bg-surface-raised text-ink text-sm">
          Back
        </button>
      </div>
    );
  }
  const { user, totals, games, recent } = player;
  const personalRtp = totals.wagered > 0 ? totals.won / totals.wagered : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 bg-surface rounded-lg p-5">
        <button onClick={onBack} className="px-3 py-1.5 rounded-md bg-surface-raised text-ink text-sm shrink-0">
          Back
        </button>
        <Avatar image={user.profilePicture} loading={false} id={user.id} size="medium" level={user.level} />
        <div className="flex flex-col">
          <span className="text-ink font-semibold text-lg flex items-center gap-2">
            {user.username}
            {user.isAdmin && <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">admin</span>}
          </span>
          <span className="text-xs text-ink-muted">
            Level {user.level} · joined {new Date(user.joined).toLocaleDateString()}
            {user.referredBy ? ` · referred by ${user.referredBy}` : ""} · {user.referrals} referrals
          </span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-ink-muted">Balance</div>
          <div className="text-xl font-semibold text-accent-gold">
            <Monetary value={Math.floor(user.walletBalance)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title={`House net on this player (${windowText})`}>
          <span className={netClass(totals.net)}>
            <Monetary value={totals.net} />
          </span>
        </StatCard>
        <StatCard title={`Wagered (${windowText})`}>
          <Monetary value={totals.wagered} />
        </StatCard>
        <StatCard
          title={`Personal RTP (${windowText})`}
          sub={totals.biggestWin.type ? `biggest win ${WIN_LABELS[totals.biggestWin.type] || totals.biggestWin.type}` : undefined}
        >
          {personalRtp !== null ? pct(personalRtp) : "-"}
        </StatCard>
        <StatCard title={`Faucet claimed (${windowText})`} sub={`${user.inventoryCount} items in inventory`}>
          <Monetary value={totals.faucet} />
        </StatCard>
      </div>

      <Panel title={`Games (${windowText})`}>
        {games.length === 0 ? (
          <p className="text-ink-muted text-sm">No games played in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-ink-muted">
                  <th className="font-medium py-2 pr-4">Game</th>
                  <th className="font-medium py-2 pr-4">Plays</th>
                  <th className="font-medium py-2 pr-4">Wagered</th>
                  <th className="font-medium py-2 pr-4">Won</th>
                  <th className="font-medium py-2">House net</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.game} className="border-t border-line">
                    <td className="py-2.5 pr-4 text-ink">{GAME_LABELS[g.game] || g.game}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{g.plays.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-ink-soft"><Monetary value={g.wagered} /></td>
                    <td className="py-2.5 pr-4 text-ink-soft"><Monetary value={g.won} /></td>
                    <td className={`py-2.5 font-semibold ${netClass(g.net)}`}><Monetary value={g.net} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel title="Marketplace">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Spent buying</span><span className="text-ink font-semibold"><Monetary value={totals.marketSpent} /></span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Earned selling</span><span className="text-ink font-semibold"><Monetary value={totals.marketEarned} /></span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Items sold to house</span><span className="text-ink font-semibold"><Monetary value={totals.itemsSold} /></span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Last active</span><span className="text-ink-muted">{totals.lastActive ? new Date(totals.lastActive).toLocaleString() : "-"}</span></div>
          </div>
        </Panel>
        <Panel title="Recent transactions">
          {recent.length === 0 ? (
            <p className="text-ink-muted text-sm">No transactions yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5 text-sm max-h-64 overflow-y-auto pr-1">
              {recent.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-t border-line pt-1.5 first:border-0 first:pt-0">
                  <span className="text-ink-soft">{label(t.type)}</span>
                  <span className="flex items-center gap-3">
                    <span className={t.direction === "credit" ? "text-green-400" : "text-red-400"}>
                      {t.direction === "credit" ? "+" : "-"}
                      <Monetary value={t.amount} />
                    </span>
                    <span className="text-xs text-ink-muted w-28 text-right">{new Date(t.createdAt).toLocaleString()}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

const BackofficeView: React.FC<Props> = ({
  userData, isAdmin, days, setDays, overview, games, cases, series, wins, usersPage,
  page, setPage, search, changeSearch, loading, error,
  playerId, player, playerLoading, openPlayer, closePlayer,
}) => {
  if (!userData || !isAdmin) {
    return <div className="w-full flex justify-center py-16 text-ink-soft">Nothing to see here.</div>;
  }
  if (loading) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1200px] px-4 py-8">
          <Skeleton height={420} borderRadius={12} highlightColor="#161427" baseColor="#1c1a31" />
        </div>
      </div>
    );
  }
  if (error || !overview || !games || !cases) {
    return <div className="w-full flex justify-center py-16 text-ink-muted">Could not load the numbers.</div>;
  }

  const windowText = days ? `last ${days} days` : "all time";
  const chartText = days ? `last ${days} days` : "last 90 days";
  const filled = fillDays(series || [], days);
  const totalWagered = games.games.reduce((s, g) => s + g.wagered, 0);
  const totalNet = games.games.reduce((s, g) => s + g.net, 0);
  const totalFaucet = games.issuance.reduce((s, l) => s + l.issued, 0);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1200px] px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-semibold text-ink">Backoffice</h1>
          <div className="flex gap-1 bg-surface rounded-lg p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.text}
                onClick={() => setDays(w.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  days === w.value ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {w.text}
              </button>
            ))}
          </div>
        </div>

        {playerId ? (
          <PlayerDetail player={player} loading={playerLoading} windowText={windowText} onBack={closePlayer} />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Users" sub={days ? `+${overview.users.new} new in the window` : undefined}>
                {overview.users.total.toLocaleString()}
              </StatCard>
              <StatCard title={`Players active (${windowText})`}>{overview.users.active.toLocaleString()}</StatCard>
              <StatCard title="KP in circulation" sub="minted minus reclaimed, all time">
                <Monetary value={overview.economy.supply} />
              </StatCard>
              <StatCard title="House balance" sub="lifetime edge minus payouts">
                <span className={netClass(overview.economy.houseBalance)}>
                  <Monetary value={overview.economy.houseBalance} />
                </span>
              </StatCard>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title={`GGR (${windowText})`} sub="wagered minus game payouts">
                <span className={netClass(totalNet)}>
                  <Monetary value={totalNet} />
                </span>
              </StatCard>
              <StatCard title={`Wagered (${windowText})`}>
                <Monetary value={totalWagered} />
              </StatCard>
              <StatCard title={`Hold (${windowText})`} sub="GGR over wagered">
                {totalWagered > 0 ? pct(totalNet / totalWagered) : "-"}
              </StatCard>
              <StatCard title={`Faucet (${windowText})`} sub="KP printed to players">
                <Monetary value={totalFaucet} />
              </StatCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AdminChart
                title={`House GGR by day (${chartText})`}
                points={filled.map((p) => ({ day: p.day, values: [p.ggr] }))}
                series={[{ name: "GGR", color: CHART_INDIGO }]}
                mode="bars"
                polarity
                money
              />
              <AdminChart
                title={`Wagered by day (${chartText})`}
                points={filled.map((p) => ({ day: p.day, values: [p.wagered] }))}
                series={[{ name: "Wagered", color: CHART_INDIGO }]}
                mode="bars"
                money
              />
              <AdminChart
                title={`Faucet vs GGR (${chartText})`}
                points={filled.map((p) => ({ day: p.day, values: [p.faucet, p.ggr] }))}
                series={[
                  { name: "Faucet", color: CHART_AMBER },
                  { name: "GGR", color: CHART_INDIGO },
                ]}
                mode="lines"
                money
              />
              <AdminChart
                title={`Active players by day (${chartText})`}
                points={filled.map((p) => ({ day: p.day, values: [p.players] }))}
                series={[{ name: "Players", color: CHART_INDIGO }]}
                mode="lines"
              />
            </div>

            <Panel title={`Games (${windowText}, most profitable first)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-ink-muted">
                      <th className="font-medium py-2 pr-4">Game</th>
                      <th className="font-medium py-2 pr-4">Plays</th>
                      <th className="font-medium py-2 pr-4">Players</th>
                      <th className="font-medium py-2 pr-4">Wagered</th>
                      <th className="font-medium py-2 pr-4">Paid out</th>
                      <th className="font-medium py-2 pr-4">RTP actual</th>
                      <th className="font-medium py-2 pr-4">RTP design</th>
                      <th className="font-medium py-2 pr-4">Biggest win</th>
                      <th className="font-medium py-2">House net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.games.map((g) => {
                      const kpGame = KP_GAMES.has(g.game);
                      const actual = kpGame && g.wagered > 0 ? g.paidOut / g.wagered : null;
                      return (
                        <tr key={g.game} className="border-t border-line">
                          <td className="py-3 pr-4 text-ink">{GAME_LABELS[g.game] || g.game}</td>
                          <td className="py-3 pr-4 text-ink-soft">{g.plays.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-ink-soft">{g.uniquePlayers.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-ink-soft"><Monetary value={g.wagered} /></td>
                          <td className="py-3 pr-4 text-ink-soft"><Monetary value={g.paidOut} /></td>
                          <td className={`py-3 pr-4 font-semibold ${actual !== null ? rtpClass(actual, g.theoRtp, g.wagered) : "text-ink-muted"}`}>
                            {actual !== null ? pct(actual) : "items"}
                          </td>
                          <td className="py-3 pr-4 text-ink-muted">{kpGame && g.theoRtp ? pct(g.theoRtp) : "-"}</td>
                          <td className="py-3 pr-4 text-ink-soft">{g.biggestWin > 0 ? <Monetary value={g.biggestWin} /> : "-"}</td>
                          <td className={`py-3 font-semibold ${netClass(g.net)}`}><Monetary value={g.net} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-muted mt-2">
                Cases and battles pay winners in items, so their buybacks appear under item buybacks below.
                RTP flags red past 3 points over design once a game has real volume.
              </p>
            </Panel>

            <Panel title={`Biggest wins (${windowText})`}>
              {!wins || wins.length === 0 ? (
                <p className="text-ink-muted text-sm">No game wins in this window.</p>
              ) : (
                <div className="flex flex-col gap-1.5 text-sm">
                  {wins.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 border-t border-line pt-1.5 first:border-0 first:pt-0">
                      <span className="w-5 text-ink-muted">{i + 1}</span>
                      <button
                        onClick={() => openPlayer(w.userId)}
                        className="bg-transparent p-0 text-ink hover:text-accent-light text-left"
                      >
                        {w.username}
                      </button>
                      <span className="text-ink-muted">{WIN_LABELS[w.type] || w.type}</span>
                      <span className="ml-auto flex items-center gap-3">
                        {w.multiple && (
                          <span className="text-xs text-ink-muted">
                            x{w.multiple >= 100 ? Math.round(w.multiple).toLocaleString() : w.multiple.toFixed(1)}
                          </span>
                        )}
                        <span className="text-accent-gold font-semibold"><Monetary value={w.amount} /></span>
                        <span className="text-xs text-ink-muted w-20 text-right">{new Date(w.at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Panel title="Other house lines">
                {games.houseLines.length === 0 ? (
                  <p className="text-ink-muted text-sm">Nothing in this window.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {games.houseLines.map((l) => (
                      <div key={l.type} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">{label(l.type)} ({l.count.toLocaleString()})</span>
                        <span className={`font-semibold ${netClass(l.net)}`}><Monetary value={l.net} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="KP printed (faucets)">
                {games.issuance.length === 0 ? (
                  <p className="text-ink-muted text-sm">Nothing in this window.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {games.issuance.map((l) => (
                      <div key={l.type} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">{label(l.type)} ({l.count.toLocaleString()})</span>
                        <span className="text-ink font-semibold"><Monetary value={l.issued} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <Panel title={`Cases (${windowText}, most opened first)`}>
              {cases.length === 0 ? (
                <p className="text-ink-muted text-sm py-4 text-center">No cases opened in this window.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-ink-muted">
                        <th className="font-medium py-2 pr-4">Case</th>
                        <th className="font-medium py-2 pr-4">Opens</th>
                        <th className="font-medium py-2 pr-4">Spent on opens</th>
                        <th className="font-medium py-2 pr-4">Price</th>
                        <th className="font-medium py-2">Last opened</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((c) => (
                        <tr key={c.caseId} className="border-t border-line">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              {c.image && <img src={c.image} alt={c.title} className="w-10 h-8 object-contain" />}
                              <span className="text-ink">{c.title}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-ink font-semibold">{c.opens.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-ink-soft"><Monetary value={c.spent} /></td>
                          <td className="py-3 pr-4 text-ink-soft">{c.price !== null ? <Monetary value={c.price} /> : "-"}</td>
                          <td className="py-3 text-ink-muted">{new Date(c.lastOpened).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Users">
              <input
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search by username"
                className="w-full md:w-72 bg-surface-nav rounded-md px-3 py-2 text-ink text-sm focus:outline-none mb-3"
              />
              {!usersPage ? (
                <Skeleton height={200} borderRadius={8} highlightColor="#161427" baseColor="#1c1a31" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-ink-muted">
                          <th className="font-medium py-2 pr-4">User</th>
                          <th className="font-medium py-2 pr-4">Level</th>
                          <th className="font-medium py-2 pr-4">Balance</th>
                          <th className="font-medium py-2 pr-4">Wagered ({windowText})</th>
                          <th className="font-medium py-2 pr-4">Joined</th>
                          <th className="font-medium py-2 pr-4">Last active</th>
                          <th className="font-medium py-2">Referred by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersPage.users.map((u) => (
                          <tr
                            key={u.id}
                            onClick={() => openPlayer(u.id)}
                            className="border-t border-line cursor-pointer hover:bg-surface-nav transition-colors"
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                <Avatar image={u.profilePicture} loading={false} id={u.id} size="small" level={0} />
                                <span className="text-ink">{u.username}</span>
                                {u.isAdmin && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">admin</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-ink-soft">{u.level}</td>
                            <td className="py-3 pr-4 text-ink-soft"><Monetary value={Math.floor(u.walletBalance)} /></td>
                            <td className="py-3 pr-4 text-ink-soft"><Monetary value={u.wagered} /></td>
                            <td className="py-3 pr-4 text-ink-muted">{new Date(u.joined).toLocaleDateString()}</td>
                            <td className="py-3 pr-4 text-ink-muted">
                              {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-3 text-ink-muted">{u.referredBy || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-sm text-ink-muted">
                    <span>{usersPage.total.toLocaleString()} users</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(page - 1)}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-md bg-surface-raised disabled:opacity-40 text-ink"
                      >
                        Prev
                      </button>
                      <span>{usersPage.page} / {usersPage.pages}</span>
                      <button
                        onClick={() => setPage(page + 1)}
                        disabled={page >= usersPage.pages}
                        className="px-3 py-1.5 rounded-md bg-surface-raised disabled:opacity-40 text-ink"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
};

export default BackofficeView;
