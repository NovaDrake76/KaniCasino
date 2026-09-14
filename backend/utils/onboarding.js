// how long daisu's first-login tour stays on offer after signup. an account the flag reaches later
// has been playing without it, so she does not greet it as a new face
const OFFER_DAYS = 7;

// what /users/me says about the tour: nothing for an account from before it or an offer that lapsed
const tourOf = (user, now = Date.now()) => {
  const status = user && user.onboarding && user.onboarding.status;
  if (!status) return null;
  if (status === "offered" && now - user._id.getTimestamp().getTime() > OFFER_DAYS * 86400000) return null;
  return { status, step: user.onboarding.step || null };
};

module.exports = { OFFER_DAYS, tourOf };
