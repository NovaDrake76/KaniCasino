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
