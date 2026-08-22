// how a shared fan card looks. the poster styles come with the crown, so losing a board
// drops the player back to the pinned panel, which is the only one carrying their own text.
const PINNED = "pinned";
const POSTERS = ["notice", "funk", "agit", "vhs", "foil"];
const KEYS = [PINNED, ...POSTERS];

const isTopFan = (user) => !!(user && user.fanRank && user.fanRank.rank === 1);

const heldStyles = (user) => (isTopFan(user) ? [...KEYS] : [PINNED]);

// checked on every read rather than cleared on loss: the sweep can take a board away at
// any time and nothing else runs afterwards to tidy the stored choice up.
const wornStyle = (user) => {
  const chosen = user && user.cardStyle;
  return heldStyles(user).includes(chosen) ? chosen : PINNED;
};

module.exports = { PINNED, POSTERS, KEYS, isTopFan, heldStyles, wornStyle };
