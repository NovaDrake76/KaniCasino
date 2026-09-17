// daisu's shop: each item opens one feature for accounts in her beta, once, for good, and its price is a sink: it goes to the mint and buys nothing but the unlock.
// prices climb like stairs, each about what the mission chapter before it pays; the license and the book together stay near what chapters one and two pay, because chapter three has missions that need both
const ITEMS = [
  { key: "chatPass", price: 1000, level: 10 },
  { key: "tradersLicense", price: 3000, level: 10 },
  { key: "collectionBook", price: 6000, level: 10 },
  { key: "predictionPass", price: 15000, level: 15 },
];

const itemOf = (key) => ITEMS.find((item) => item.key === key) || null;

module.exports = { ITEMS, itemOf };
