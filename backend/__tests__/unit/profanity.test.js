const profanity = require("../../utils/profanity");

describe("swearing in the chat", () => {
  const refused = (text) => expect(profanity.findProfanity(text)).not.toBeNull();
  const ok = (text) => expect(profanity.findProfanity(text)).toBeNull();

  it("catches the strong words in english", () => {
    refused("fuck off");
    refused("what the fuck");
    refused("this is bullshit");
    refused("you prick");
    refused("asshole");
  });

  it("catches them in portuguese, which is what most of the room types", () => {
    refused("que merda");
    refused("porra");
    refused("caralho");
    refused("vai se foder");
    refused("filha da puta");
  });

  it("catches a word somebody has dressed up", () => {
    refused("f u c k");
    refused("fuuuck");
    refused("f*ck");
    refused("sh1t");
    refused("Sh!t");
    refused("FUCK");
  });

  it("matches whole words, so ordinary english survives", () => {
    // the reason this is not the slur matcher: that one looks anywhere inside the text,
    // which here would refuse half the dictionary
    ok("class");
    ok("pass the case");
    ok("assassin");
    ok("assume");
    ok("harass");
    ok("embarrass");
    ok("compass");
    ok("cocktail");
    ok("Dickens");
    ok("analysis");
  });

  it("leaves the portuguese words that are only rude in the wrong mouth", () => {
    ok("cute");
    ok("curioso");
    ok("documento");
    ok("disputa acirrada");
    ok("reputacao");
    ok("porta");
    ok("pinto");
    ok("pau");
    ok("rola");
    ok("piranha");
  });

  it("leaves ordinary chat alone", () => {
    ok("gg everyone");
    ok("3.5x on crash");
    ok("i cashed out at 1.01");
    ok("boa sorte pessoal");
    ok("pulled sakuya from the 12k case");
  });

  it("can be turned off without a deploy", () => {
    const was = process.env.CHAT_PROFANITY;
    process.env.CHAT_PROFANITY = "false";
    expect(profanity.findProfanity("fuck")).toBeNull();
    process.env.CHAT_PROFANITY = was;
  });

  it("names nothing that is only ever a slur, which belongs in the other list", () => {
    // the two filters do different jobs and their lists must not drift together
    const slurs = require("../../utils/nameFilter").SLURS;
    expect(profanity.TERMS.filter((term) => slurs.includes(term))).toEqual([]);
  });
});
