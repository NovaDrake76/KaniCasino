// the mission catalog. definitions live here as data; the per-metric evaluation
// lives in missions.js keyed by `metric`. rewards are KP credited on manual claim.
// counters are derived from activity AT OR AFTER the launch timestamp, so shipping
// this never retroactively pays out a veteran's pre-launch history.

// read at call time (not module load) so tests and deploys can override the env
function missionsLaunchAt() {
  return process.env.MISSIONS_LAUNCH_AT
    ? new Date(process.env.MISSIONS_LAUNCH_AT)
    : new Date("2026-07-15T00:00:00.000Z");
}

const CATALOG = [
  // onboarding
  { key: "first-bonus", category: "onboarding", title: "Free money", description: "Claim your bonus for the first time.", metric: "bonusesClaimed", target: 1, reward: 250 },
  { key: "first-case", category: "onboarding", title: "Crack one open", description: "Open your very first case.", metric: "casesOpened", target: 1, reward: 250 },
  // disabled until there is a UI to set a profile picture (active:false hides it everywhere)
  { key: "set-avatar", category: "onboarding", title: "Show your face", description: "Set a profile picture.", metric: "profilePictureSet", target: 1, reward: 250, active: false },
  { key: "first-sale", category: "onboarding", title: "Open for business", description: "Sell an item on the marketplace.", metric: "marketSales", target: 1, reward: 300 },

  // games
  { key: "try-crash", category: "games", title: "Nerves of steel", description: "Place a bet on Crash.", metric: "gamesPlayed:crash", target: 1, reward: 200 },
  { key: "try-coinflip", category: "games", title: "Heads or tails", description: "Place a bet on Coin Flip.", metric: "gamesPlayed:coinflip", target: 1, reward: 200 },
  { key: "try-slots", category: "games", title: "One more spin", description: "Spin the slot machine.", metric: "gamesPlayed:slots", target: 1, reward: 200 },
  { key: "coinflip-win", category: "games", title: "Called it", description: "Win a round of Coin Flip.", metric: "coinflipWins", target: 1, reward: 500 },
  { key: "battle-win", category: "games", title: "Last one standing", description: "Win a case battle.", metric: "battlesWon", target: 1, reward: 1000 },
  { key: "cases-10", category: "games", title: "Case cracker", description: "Open 10 cases.", metric: "casesOpened", target: 10, reward: 1500 },
  { key: "cases-100", category: "games", title: "Case connoisseur", description: "Open 100 cases.", metric: "casesOpened", target: 100, reward: 6000 },
  { key: "big-win", category: "games", title: "Big score", description: "Land a 10,000 K₽ payout in a single play.", metric: "bigWin", target: 10000, reward: 2500 },

  // collection
  { key: "complete-collection", category: "collection", title: "Completionist", description: "Complete any case collection.", metric: "collectionsCompleted", target: 1, reward: 5000 },

  // community
  { key: "add-friend", category: "community", title: "Not alone", description: "Add your first friend.", metric: "friendsAdded", target: 1, reward: 300 },
  { key: "join-discord", category: "community", title: "Join the Discord", description: "Hop into the KaniCasino Discord.", metric: "social", social: "discord", target: 1, reward: 150 },
  { key: "follow-x", category: "community", title: "Follow on X", description: "Follow KaniCasino on X.", metric: "social", social: "x", target: 1, reward: 150 },
];

const BY_KEY = new Map(CATALOG.map((m) => [m.key, m]));
const byKey = (key) => BY_KEY.get(key) || null;

module.exports = { CATALOG, byKey, missionsLaunchAt };
