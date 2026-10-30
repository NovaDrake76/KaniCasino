// what daisu says over a coupon drop, in the voice of her lines on the site. {amount} is filled in from the drop
const COUPON_LINES = [
  "Fine. Free K₽. Don't say I never give you anything.",
  "Not all of you get this. The rest of you can cry.",
  "{amount} for the fastest. Slowpokes get nothing, as usual.",
  "I found {amount} under the jar. Fastest hands get it, go.",
  "Free money, Mr. Gamblers. Try not to lose it all in one spin. You will, though.",
  "A few coupons, a lot more of you. Do the math. lolol~",
  "I'm feeling generous today. Don't get used to it.",
  "Still broke? Lucky you, I'm in a good mood.",
  "Coupon's up. Take it before I change my mind.",
  "A coupon. From me. Say thank you.",
  "Here's your pity system. It won't wait for you.",
  "This one's for my Discord regulars. See? Joining paid off.",
  "Yes, it's real K₽. No, you can't have two.",
  "Spend it on a Dogs Case. Please. Someone has to.",
  "Verified accounts only. I don't feed alts.",
  "The jar overflowed, so here. {amount}, while it lasts.",
  "Don't go all in with it. ...Okay, go all in with it.",
  "Click fast, Mr. Gambler. I'm not handing out seconds.",
];

const fill = (line, { amount }) => line.replace(/\{amount\}/g, amount);

const couponLine = (vars, random = Math.random) => fill(COUPON_LINES[Math.floor(random() * COUPON_LINES.length)], vars);

module.exports = { COUPON_LINES, couponLine };
