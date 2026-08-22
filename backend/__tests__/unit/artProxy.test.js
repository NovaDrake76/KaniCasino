const artProxy = require("../../utils/artProxy");

describe("which art the proxy will fetch", () => {
  it("takes the hosts our own art and steam's art live on", () => {
    expect(artProxy.allow("https://kanicases.s3.amazonaws.com/touhou/Keine.png")).toBeTruthy();
    expect(artProxy.allow("https://kanicases.s3.us-east-1.amazonaws.com/cases/bluearchive/10033.webp")).toBeTruthy();
    expect(artProxy.allow("https://community.akamai.steamstatic.com/economy/image/abc/360fx360f")).toBeTruthy();
  });

  it("refuses anything else, which is the point of the list", () => {
    expect(artProxy.allow("https://example.com/x.png")).toBeNull();
    expect(artProxy.allow("https://kanicases.s3.amazonaws.com.evil.test/x.png")).toBeNull();
    expect(artProxy.allow("https://evil.test/?u=community.akamai.steamstatic.com")).toBeNull();
  });

  it("refuses the schemes that would reach inside the box", () => {
    expect(artProxy.allow("http://community.akamai.steamstatic.com/x.png")).toBeNull();
    expect(artProxy.allow("file:///etc/passwd")).toBeNull();
    expect(artProxy.allow("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(artProxy.allow("https://127.0.0.1:5001/users/me")).toBeNull();
  });

  it("refuses what is not a url at all", () => {
    expect(artProxy.allow(undefined)).toBeNull();
    expect(artProxy.allow("")).toBeNull();
    expect(artProxy.allow("not a url")).toBeNull();
    expect(artProxy.allow(["https://community.akamai.steamstatic.com/x.png"])).toBeNull();
    expect(artProxy.allow("https://community.akamai.steamstatic.com/" + "x".repeat(3000))).toBeNull();
  });
});

describe("the size guard", () => {
  it("reads a content-length over the cap, and shrugs at a missing one", () => {
    expect(artProxy.tooBig(String(artProxy.MAX_BYTES + 1))).toBe(true);
    expect(artProxy.tooBig(String(artProxy.MAX_BYTES))).toBe(false);
    expect(artProxy.tooBig("75394")).toBe(false);
    expect(artProxy.tooBig(null)).toBe(false);
    expect(artProxy.tooBig("nonsense")).toBe(false);
  });
});
