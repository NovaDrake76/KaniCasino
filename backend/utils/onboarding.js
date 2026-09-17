// how long after signup daisu greets an account as a new face; older accounts get her hello for players who already know their way
const OFFER_DAYS = 7;

// what /users/me says about the tour: an account from before it, or one whose offer went untaken, is offered it as a returning player
const tourOf = (user, now = Date.now()) => {
  const status = user && user.onboarding && user.onboarding.status;
  const old = !!user && now - user._id.getTimestamp().getTime() > OFFER_DAYS * 86400000;
  if (!status) return { status: "offered", step: null, returning: true };
  if (status === "offered") return { status, step: null, returning: old };
  return { status, step: user.onboarding.step || null };
};

module.exports = { OFFER_DAYS, tourOf };
