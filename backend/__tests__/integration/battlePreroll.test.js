process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const { generateServerSeed, hashServerSeed } = require("../../utils/provablyFair");
const { prerollBattle } = require("../../games/battleEngine");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

async function makeCase() {
  const s = uniqueSuffix();
  const item = await Item.create({ name: `i-${s}`, image: "i.png", rarity: "3", baseValue: 100 });
  return Case.create({ title: `c-${s}`, image: "c.png", price: 50, items: [item._id] });
}

function battleDoc(cases) {
  const serverSeed = generateServerSeed();
  return {
    mode: "1v1",
    cases: cases.map((c) => c._id),
    players: [
      { slot: 0, clientSeed: "alice" },
      { slot: 1, clientSeed: "bob" },
    ],
    pfServerSeed: serverSeed,
    pfServerSeedHash: hashServerSeed(serverSeed),
  };
}

test("a battle repeating one case prerolls a round per entry, in order", async () => {
  const c = await makeCase();
  const rolls = await prerollBattle(battleDoc([c, c, c]));
  expect(rolls).toHaveLength(3);
  for (const round of rolls) {
    expect(round).toHaveLength(2);
    expect(round.every((it) => it.name.startsWith("i-"))).toBe(true);
  }
});

test("mixed cases preroll in the order the battle lists them", async () => {
  const a = await makeCase();
  const b = await makeCase();
  const rolls = await prerollBattle(battleDoc([b, a, b]));
  const aItem = (await Case.findById(a._id).populate("items")).items[0].name;
  const bItem = (await Case.findById(b._id).populate("items")).items[0].name;
  expect(rolls.map((round) => round[0].name)).toEqual([bItem, aItem, bItem]);
});

test("a deleted case still fails the preroll", async () => {
  const a = await makeCase();
  const doc = battleDoc([a]);
  await Case.deleteOne({ _id: a._id });
  await expect(prerollBattle(doc)).rejects.toThrow(/no longer exists/);
});
