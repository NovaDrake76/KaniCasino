const { parseOrigins, originAllowed, PREFLIGHT_MAX_AGE } = require("../../utils/cors");

describe("allowed origins", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseOrigins("https://a.com, https://b.com ,")).toEqual(["https://a.com", "https://b.com"]);
  });

  it("falls back to the production domain when unset", () => {
    expect(parseOrigins("")).toEqual(["https://kanicasino.com"]);
    expect(parseOrigins(undefined)).toEqual(["https://kanicasino.com"]);
  });
});

describe("who gets through the cors gate", () => {
  const prod = { isDevelopment: false, allowedOrigins: ["https://kanicasino.com"] };

  it("lets a listed browser origin through", () => {
    expect(originAllowed("https://kanicasino.com", prod)).toBe(true);
  });

  it("refuses an origin that is not listed", () => {
    expect(originAllowed("https://evil.example", prod)).toBe(false);
  });

  // the regression this file exists for: curl, server-to-server, the uptime probe and the
  // mail provider posting the one-click unsubscribe all send no Origin at all
  it("lets a request with no Origin through", () => {
    expect(originAllowed(undefined, prod)).toBe(true);
    expect(originAllowed("", prod)).toBe(true);
  });

  it("lets everything through in development", () => {
    expect(originAllowed("https://evil.example", { isDevelopment: true, allowedOrigins: [] })).toBe(true);
  });
});

// a preflight the browser cannot cache is a second round trip on every authenticated
// request, and nothing else in the suite would notice it going missing
describe("preflight caching", () => {
  it("keeps a max-age the browser will actually honour", () => {
    expect(PREFLIGHT_MAX_AGE).toBeGreaterThan(0);
    // chrome caps it here and silently clamps anything larger
    expect(PREFLIGHT_MAX_AGE).toBeLessThanOrEqual(7200);
  });

  it("is wired into the server's cors options", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../../index.js"), "utf8");
    expect(source).toMatch(/maxAge:\s*PREFLIGHT_MAX_AGE/);
  });
});
