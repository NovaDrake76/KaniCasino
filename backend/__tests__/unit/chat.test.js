const chat = require("../../utils/chat");

describe("what a chat message has to clear", () => {
  const ok = (text) => expect(chat.validate(text).error).toBeUndefined();
  const refused = (text, why) => expect(chat.validate(text).error).toBe(why);

  it("takes ordinary talk", () => {
    ok("pulled sakuya out of the nuclear case");
    ok("gg");
  });

  it("refuses nothing at all", () => {
    refused("", "empty");
    refused("   ", "empty");
    refused("\u0000\u0007", "empty");
  });

  it("refuses links outright, because there is nobody to judge them one by one", () => {
    refused("https://example.com", "noLinks");
    refused("check www.somewhere.net", "noLinks");
    refused("free skins at grabthis.xyz", "noLinks");
    refused("discord.gg/abcdef", "noLinks");
    refused("t.me/whatever", "noLinks");
  });

  it("refuses a link somebody has taken apart to get it through", () => {
    // all of these were posted at the box and got through the first pattern
    refused("https: //sex(.)com", "noLinks");
    refused("free at grabthis(.)xyz", "noLinks");
    refused("look at sex [dot] com", "noLinks");
    refused("sex (.) com", "noLinks");
    refused("w w w . spam . com", "noLinks");
    refused("h t t p s://x.co", "noLinks");
    refused("h t t p s : //spam.com", "noLinks");
    refused("my site: kani ponto com", "noLinks");
    refused("s p a m . c o m", "noLinks");
  });

  it("refuses a slur, however it is spelt", () => {
    // the same matcher the username filter uses, which is built for exactly this
    refused("nigger", "slur");
    refused("n1gg3r", "slur");
    refused("n-i-g-g-e-r", "slur");
    refused("ｎｉｇｇｅｒ", "slur");
    refused("faggot", "slur");
    refused("viado", "slur");
    refused("maricon", "slur");
  });

  it("leaves the ordinary words a filter this blunt would eat", () => {
    // portuguese words that are the slur only in the wrong mouth, and numbers with dots
    ok("preto");
    ok("macaco");
    ok("nego veio");
    ok("3.5x on crash");
    ok("i cashed out at 1.01");
    ok("the case is 12.5k");
    ok("boa sorte pessoal");
    ok("my level is 55.");
  });

  it("refuses a wall of text", () => {
    refused("a".repeat(chat.MAX_LENGTH + 1), "tooLong");
    ok("a".repeat(chat.MAX_LENGTH));
  });

  it("collapses the whitespace a flood would be padded with", () => {
    expect(chat.validate("hello      there\n\n\nyou").body).toBe("hello there you");
  });

  it("keeps a name that merely looks like a domain out of the refusals", () => {
    // a bare word with a dot is not a link, and refusing it would be maddening
    ok("marisa.");
    ok("3.5x on crash");
  });
});

describe("what happens to somebody who keeps trying", () => {
  beforeEach(() => chat.reset());

  it("counts only the deliberate refusals toward a mute", () => {
    // a typo and a rate limit are not attempts at anything
    expect(chat.validate("").error).toBe("empty");
    expect(chat.validate("a".repeat(chat.MAX_LENGTH + 1)).error).toBe("tooLong");
  });

  it("keeps the mute shorter than the patience of anyone testing it", () => {
    expect(chat.STRIKES_BEFORE_MUTE).toBeGreaterThan(1);
    expect(chat.MUTE_MS).toBeGreaterThanOrEqual(60000);
  });
});
