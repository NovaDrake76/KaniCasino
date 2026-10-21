process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Marketplace = require("../../models/Marketplace");
const BuyOrder = require("../../models/BuyOrder");
const { editCharacter } = require("../../scripts/editCharacter");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@k.co`, password: "x", ...fields });
};

const momoyo = () => Item.create({ name: "Himemushi", slug: "himemushi", image: "https://k/touhou/Himemushi.png", rarity: "2" });

describe("renaming a character", () => {
  it("renames the item, the pins on it and the snapshots on the market, and keeps the slug", async () => {
    const item = await momoyo();
    const fan = await makeUser({ fixedItem: { name: "Himemushi", image: item.image, rarity: "2" } });
    const seller = await makeUser();
    await Marketplace.create({ sellerId: seller._id, item: item._id, price: 90, itemName: "Himemushi", itemImage: item.image, rarity: "2", uniqueId: "m-1" });
    await BuyOrder.create({ userId: seller._id, item: item._id, itemName: "Himemushi", itemImage: item.image, rarity: "2", price: 80, quantity: 1, escrow: 80 });

    const result = await editCharacter("Himemushi", { name: "Momoyo", dry: false });

    expect(result.done).toMatchObject({ items: 1, pins: 1, listings: 1, orders: 1 });
    expect(await Item.findById(item._id).lean()).toMatchObject({ name: "Momoyo", slug: "himemushi" });
    expect((await User.findById(fan._id, { fixedItem: 1 }).lean()).fixedItem.name).toBe("Momoyo");
    expect((await Marketplace.findOne({ uniqueId: "m-1" }).lean()).itemName).toBe("Momoyo");
    expect((await BuyOrder.findOne({ item: item._id }).lean()).itemName).toBe("Momoyo");
  });

  it("changes nothing on a dry run", async () => {
    const item = await momoyo();
    await makeUser({ fixedItem: { name: "Himemushi", image: item.image } });

    const result = await editCharacter("Himemushi", { name: "Momoyo" });

    expect(result.plan).toMatchObject({ pins: 1, listings: 0, orders: 0 });
    expect(result.done).toBeUndefined();
    expect((await Item.findById(item._id).lean()).name).toBe("Himemushi");
  });

  it("refuses a name another character already has", async () => {
    await momoyo();
    await Item.create({ name: "Momoyo", image: "x", rarity: "3" });

    const result = await editCharacter("Himemushi", { name: "Momoyo", dry: false });

    expect(result.error).toMatch(/already a character/);
    expect(await Item.countDocuments({ name: "Himemushi" })).toBe(1);
  });
});

describe("new art for a character", () => {
  it("moves the item and the pins on its base art to the new picture, and leaves an alt outfit's pin alone", async () => {
    const mai = await Item.create({ name: "Mai Teireida", image: "https://k/touhou/Mai.png", rarity: "2" });
    const base = await makeUser({ fixedItem: { name: "Mai Teireida", image: mai.image } });
    const alt = await makeUser({ fixedItem: { name: "Mai Teireida", variant: "Mai (Summer)", image: "https://k/alt.png" } });

    await editCharacter("Mai Teireida", { image: "https://k/touhou/Mai_Teireida.png", dry: false });

    expect((await Item.findById(mai._id).lean()).image).toBe("https://k/touhou/Mai_Teireida.png");
    expect((await User.findById(base._id, { fixedItem: 1 }).lean()).fixedItem.image).toBe("https://k/touhou/Mai_Teireida.png");
    expect((await User.findById(alt._id, { fixedItem: 1 }).lean()).fixedItem.image).toBe("https://k/alt.png");
  });
});
