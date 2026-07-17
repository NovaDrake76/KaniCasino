// real-money mode gates controls that only matter once balances have real value (anti
// chip-dumping, later kyc and limits); fake mode leaves them off, where moving KP is harmless.
const isRealMoneyMode = () => process.env.REAL_MONEY_MODE === "true";

module.exports = { isRealMoneyMode };
