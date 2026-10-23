process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../../middleware/accountBudget", () => ({
  ...jest.requireActual("../../middleware/accountBudget"),
  accountBudget: { spend: jest.fn() },
}));
jest.mock("../../models/User", () => ({ findById: jest.fn() }));

const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { makeBudget, accountBudget } = require("../../middleware/accountBudget");
const { isAuthenticated, maybeAuthenticated } = require("../../middleware/authMiddleware");

const reqWith = (token) => ({ header: (name) => (name === "Authorization" ? `Bearer ${token}` : undefined) });
const resMock = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const tokenFor = (userId) => jwt.sign({ userId, tokenVersion: 0 }, process.env.JWT_SECRET);

beforeEach(() => jest.clearAllMocks());

describe("a request budget per account", () => {
  it("lets a burst through, then refuses until it refills", () => {
    const budget = makeBudget({ burst: 3, perSecond: 10 });
    const t = 1000000;
    expect([1, 2, 3, 4].map(() => budget.spend("a", t))).toEqual([true, true, true, false]);
    // a tenth of a second buys one more at ten a second
    expect(budget.spend("a", t + 100)).toBe(true);
    expect(budget.spend("a", t + 100)).toBe(false);
  });

  it("never lends one account's budget to another", () => {
    const budget = makeBudget({ burst: 1, perSecond: 1 });
    expect(budget.spend("a", 0)).toBe(true);
    expect(budget.spend("a", 0)).toBe(false);
    expect(budget.spend("b", 0)).toBe(true);
  });

  it("refills no further than the burst, however long the account was idle", () => {
    const budget = makeBudget({ burst: 2, perSecond: 10 });
    budget.spend("a", 0);
    const later = 60 * 60 * 1000;
    expect([1, 2, 3].map(() => budget.spend("a", later))).toEqual([true, true, false]);
  });
});

describe("the login check spends the budget before it reads the account", () => {
  it("turns an account past its budget away without a database read", async () => {
    accountBudget.spend.mockReturnValue(false);
    const res = resMock();
    const next = jest.fn();

    await isAuthenticated(reqWith(tokenFor("u1")), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("reads the account and carries on inside the budget", async () => {
    accountBudget.spend.mockReturnValue(true);
    User.findById.mockReturnValue({ select: () => Promise.resolve({ _id: "u1", tokenVersion: 0 }) });
    const next = jest.fn();

    await isAuthenticated(reqWith(tokenFor("u1")), resMock(), next);

    expect(accountBudget.spend).toHaveBeenCalledWith("u1");
    expect(next).toHaveBeenCalled();
  });

  it("never spends an account's budget on a token that does not verify", async () => {
    const res = resMock();

    await isAuthenticated(reqWith("not-a-token"), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(accountBudget.spend).not.toHaveBeenCalled();
  });

  it("does the same on pages that read better logged in", async () => {
    accountBudget.spend.mockReturnValue(false);
    const res = resMock();
    const next = jest.fn();

    await maybeAuthenticated(reqWith(tokenFor("u1")), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
