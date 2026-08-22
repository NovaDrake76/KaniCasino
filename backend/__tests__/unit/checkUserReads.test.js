const { scan, MARKER } = require("../../scripts/checkUserReads");

const flagged = (source) => scan(source).length;
const wrap = (body) => `const User = require("../models/User");\nasync function f() {\n${body}\n}\n`;

describe("reads the rule catches", () => {
  it("flags a read with no projection at all", () => {
    expect(flagged(wrap("  const u = await User.findById(id);"))).toBe(1);
    expect(flagged(wrap("  const u = await User.findOne({ email });"))).toBe(1);
    expect(flagged(wrap("  const u = await User.find({});"))).toBe(1);
  });

  it("flags the exclusion that started all of this", () => {
    expect(flagged(wrap('  const u = await User.findById(id).select("-password");'))).toBe(1);
  });

  it("flags a projection that asks for the array", () => {
    expect(flagged(wrap("  const u = await User.findById(id, { inventory: 1 });"))).toBe(1);
    expect(flagged(wrap('  const u = await User.findById(id).select("inventory fixedItem");'))).toBe(1);
  });

  it("flags findOneAndUpdate when its options carry no projection", () => {
    expect(flagged(wrap("  const o = { new: true };\n  const u = await User.findOneAndUpdate(q, up, o);"))).toBe(1);
  });
});

describe("reads the rule leaves alone", () => {
  it("takes an exclusion that names the array", () => {
    expect(flagged(wrap('  const u = await User.findById(id).select("-password -inventory");'))).toBe(0);
  });

  it("takes an inclusion list that never mentions it", () => {
    expect(flagged(wrap('  const u = await User.findById(id).select("username level");'))).toBe(0);
    expect(flagged(wrap("  const u = await User.findById(id, { username: 1 });"))).toBe(0);
  });

  it("takes the shared constant, spread or passed whole", () => {
    expect(flagged(wrap("  const u = await User.findById(id).select({ password: 0, ...WITHOUT_INVENTORY });"))).toBe(0);
    expect(flagged(wrap("  const u = await User.findById(id).select(WITHOUT_INVENTORY);"))).toBe(0);
  });

  it("follows a projection through a variable", () => {
    const body = "  const o = { new: true, projection: WITHOUT_INVENTORY };\n  const u = await User.findOneAndUpdate(q, up, o);";
    expect(flagged(wrap(body))).toBe(0);
  });

  it("follows a select built by concatenation", () => {
    const src = 'const User = require("x");\nconst PUBLIC = "username profilePicture";\nasync function f() {\n  const u = await User.findById(id).select(PUBLIC + " walletBalance");\n}\n';
    expect(flagged(src)).toBe(0);
  });

  it("reads a chain that spans lines", () => {
    expect(flagged(wrap('  const u = await User.findById(id)\n    .select("username")\n    .lean();'))).toBe(0);
  });

  it("ignores the calls that hand back no document", () => {
    expect(flagged(wrap("  const yes = await User.exists({ email });"))).toBe(0);
    expect(flagged(wrap("  const n = await User.countDocuments({});"))).toBe(0);
    expect(flagged(wrap("  await User.updateOne(q, up);"))).toBe(0);
    expect(flagged(wrap("  const r = await User.aggregate([]);"))).toBe(0);
  });

  it("ignores a read of some other model", () => {
    expect(flagged('const Item = require("x");\nasync function f() { await Item.findById(id); }')).toBe(0);
  });
});

describe("the way out", () => {
  it("takes a marked call, and only while the marking is there", () => {
    const marked = wrap(`  // ${MARKER} the copies are the subject of the call\n  const u = await User.findById(id);`);
    expect(flagged(marked)).toBe(0);
    expect(flagged(wrap("  // just an ordinary comment\n  const u = await User.findById(id);"))).toBe(1);
  });
});
