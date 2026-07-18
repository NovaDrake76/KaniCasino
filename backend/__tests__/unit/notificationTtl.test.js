const Notification = require("../../models/Notification");

// the collection was growing without bound (27k+ docs on prod); a ttl index expires each
// notification a week after it is created so it stays flat.
test("notifications carry a 7-day ttl index on createdAt", () => {
  const ttl = Notification.schema.indexes().find(([keys]) => keys.createdAt === 1);
  expect(ttl).toBeDefined();
  expect(ttl[1].expireAfterSeconds).toBe(604800); // 7 days
});
