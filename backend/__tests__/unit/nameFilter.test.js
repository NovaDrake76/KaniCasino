const {
  findSlur,
  isClean,
  normalize,
  letters,
  withoutAllowed,
  safeUsername,
} = require("../../utils/nameFilter");

// the filter exists because somebody registered one of these, so the cases that matter
// are the spellings people actually reach for rather than the dictionary form

describe("the plain form", () => {
  it("catches the word written out", () => {
    expect(isClean("nigger")).toBe(false);
    expect(isClean("faggot")).toBe(false);
    expect(isClean("chink")).toBe(false);
  });

  it("catches it inside a longer name", () => {
    expect(isClean("xX_nigga_Xx")).toBe(false);
    expect(isClean("thefaggotking")).toBe(false);
  });

  it("does not care about case", () => {
    expect(isClean("NiGgEr")).toBe(false);
  });
});

describe("the spellings people actually use", () => {
  // this is the one that was registered
  it("catches a masked letter", () => {
    expect(isClean("n*gga")).toBe(false);
    expect(isClean("n#gger")).toBe(false);
    expect(isClean("f*ggot")).toBe(false);
  });

  it("catches leetspeak", () => {
    expect(isClean("n1gg4")).toBe(false);
    expect(isClean("n166er")).toBe(false);
    expect(isClean("f4gg0t")).toBe(false);
    expect(isClean("ch1nk")).toBe(false);
  });

  it("catches separators between the letters", () => {
    expect(isClean("n-i-g-g-a")).toBe(false);
    expect(isClean("n.i.g.g.e.r")).toBe(false);
    expect(isClean("n i g g a")).toBe(false);
    expect(isClean("n_i_g_g_a")).toBe(false);
  });

  it("catches padded letters", () => {
    expect(isClean("niiiigga")).toBe(false);
    expect(isClean("nigggggger")).toBe(false);
  });

  it("catches accents and fullwidth forms", () => {
    expect(isClean("nïggér")).toBe(false);
    expect(isClean("ｎｉｇｇｅｒ")).toBe(false);
  });

  it("catches cyrillic lookalikes", () => {
    // the cyrillic е and о render as latin ones
    expect(isClean("niggеr")).toBe(false);
    expect(isClean("cоon")).toBe(false);
  });

  it("catches a mix of all of it", () => {
    expect(isClean("N.1-g*g4")).toBe(false);
  });
});

// a filter that eats real names is worse than no filter: it is invisible, and the person
// it rejects has no idea why
describe("names it must not touch", () => {
  const fine = [
    "NovaDrake",
    "Reimu",
    "MarisaKirisame",
    "xX_Sniper_Xx",
    "player1",
    "Nathan",
    "Mohamed Abdelkawi",
    "Malgorzata Bajolek",
    "Nguyen",
    "Nikita",
    "Angus",
    "Cassandra",
    "Classic",
    "Bassist",
    "Assassin",
    "Douglas",
    "Scunthorpe",
    "Penistone",
    "Cockburn",
    "Analyst",
    "Cumberland",
    "Negroni",
    "Pakistan",
    "Raccoon",
    "Tycoon",
    "Spicy",
    "Van Dyke",
    "Dijkstra",
    "Retardant",
    "Shuttlecock",
    "Titan",
    "Ganguly",
    "Gonzalez",
    // a scan of the real user table turned these up as false positives
    "Ruby Stardust",
    "star dud",
    "Custard",
    "Mustard",
    "Standard",
    // the ordinary respectful word in portuguese, and most players here are brazilian
    "Negro",
    "Negreiros",
  ];

  for (const name of fine) {
    it(`leaves ${name} alone`, () => {
      expect(isClean(name)).toBe(true);
    });
  }
});

// the allowlist is the obvious way to smuggle one through: put a permitted word next to
// the slur and a filter that asks "does this contain something allowed" waves it past
describe("hiding behind an allowed word", () => {
  const smuggled = [
    "stardustnigger",
    "raccoonnigger",
    "pakistan_nigga",
    "spicy n*gga",
    "cocoon nigga",
    "vandykefaggot",
    "NegroniN1gga",
  ];

  for (const name of smuggled) {
    it(`still blocks ${name}`, () => {
      expect(isClean(name)).toBe(false);
    });
  }

  it("cuts the allowed word out rather than skipping the check", () => {
    expect(withoutAllowed("raccoonnigger")).toContain("nigger");
    expect(withoutAllowed("raccoon").trim()).toBe("");
  });
});

// an english-only list was wide open on a site whose players are mostly brazilian
describe("portuguese and spanish", () => {
  const blocked = [
    "crioulo", "viado", "boiola", "baitola", "traveco", "travecão",
    "retardado", "mongoloide", "mongolóide",
    "maricon", "maricón", "sudaca", "negrata",
    "cr1oulo", "v-i-a-d-o", "m4ric0n",
  ];
  for (const name of blocked) {
    it(`blocks ${name}`, () => {
      expect(isClean(name)).toBe(false);
    });
  }

  // each of these is an ordinary portuguese word far more often than it is an insult, and
  // a filter that eats them is worse than one that misses the rare abuse
  const ordinary = [
    "preto", "nego", "neguinho", "macaco", "veado", "bicha", "japa", "baiano",
    "Mongolia", "Mongol", "Criolla", "Retardador", "Bibas", "Panchito",
    "arigato", "Jumento", "Bianca", "Viadutos",
  ];
  for (const name of ordinary) {
    it(`leaves ${name} alone`, () => {
      expect(isClean(name)).toBe(true);
    });
  }

  // "travecão" would otherwise compile a pattern around a character the normalised input
  // can never contain
  it("folds an accented term before compiling its pattern", () => {
    expect(findSlur("travecao")).toBeTruthy();
    expect(findSlur("travecão")).toBeTruthy();
  });

  // an allowed word that is a prefix of a blocked one disarms it entirely
  it("does not let an allowed prefix disarm a longer slur", () => {
    expect(isClean("mongoloide")).toBe(false);
    expect(isClean("Mongolia")).toBe(true);
  });
});

describe("normalising", () => {
  it("folds accents to their base letter", () => {
    expect(normalize("Ré1mü")).toBe("re1mu");
  });

  it("keeps only letters for the allowlist comparison", () => {
    expect(letters("Sc-unth.orpe")).toBe("scunthorpe");
  });

  it("treats an empty name as nothing to match", () => {
    expect(findSlur("")).toBeNull();
    expect(findSlur(null)).toBeNull();
    expect(findSlur("   ")).toBeNull();
  });
});

describe("reporting", () => {
  it("names the term it matched, for the log rather than the player", () => {
    expect(findSlur("n*gga")).toBe("nigga");
    expect(findSlur("Reimu")).toBeNull();
  });
});

// a google display name is not something the person can edit to get past this, so a
// collision must not lock them out of their own account
describe("google display names", () => {
  it("keeps a name that is fine", () => {
    expect(safeUsername("Mohamed Abdelkawi", "123")).toBe("Mohamed Abdelkawi");
  });

  it("swaps a name that is not, instead of refusing the login", () => {
    const safe = safeUsername("n*gga", "987654");
    expect(safe).not.toMatch(/gga/i);
    expect(safe).toBe("player87654");
    expect(isClean(safe)).toBe(true);
  });
});
