// daisu's shop: each item opens one feature for accounts in her beta, once, for good.
// the price is a sink: it goes to the mint and buys nothing but the unlock
const ITEMS = [
  { key: "collectionBook", price: 5000, level: 5 },
  { key: "tradersLicense", price: 2500, level: 5 },
  { key: "chatPass", price: 500, level: 5 },
  { key: "predictionPass", price: 5000, level: 15 },
];

const itemOf = (key) => ITEMS.find((item) => item.key === key) || null;

module.exports = { ITEMS, itemOf };
