const { slugify, baseSlugFor, qualifiedSlug, looksLikeId, RESERVED } = require("../../utils/slugs");

describe("slugify", () => {
  it("folds case, accents and punctuation into one form", () => {
    expect(slugify("Shiki")).toBe("shiki");
    expect(slugify("shiki")).toBe("shiki");
    expect(slugify("José Araújo")).toBe("jose-araujo");
    expect(slugify("LTA_BR")).toBe("lta-br");
    expect(slugify("LTA BR")).toBe("lta-br");
    expect(slugify("Nate ")).toBe("nate");
    expect(slugify("A.")).toBe("a");
  });

  it("gives nothing back for a name with no latin letters in it", () => {
    expect(slugify("오정남")).toBe("");
    expect(slugify("Иван")).toBe("");
    expect(slugify(":)")).toBe("");
    expect(slugify("")).toBe("");
    expect(slugify(undefined)).toBe("");
  });

  it("never ends on a hyphen, even when the cut lands on one", () => {
    const long = slugify("a".repeat(59) + " tail");
    expect(long.endsWith("-")).toBe(false);
    expect(long.length).toBeLessThanOrEqual(60);
  });
});

describe("looksLikeId", () => {
  it("accepts a real object id", () => {
    expect(looksLikeId("658b3735f85dd4546b36cf1f")).toBe(true);
  });

  // ObjectId.isValid() says true for any 12-character string, which is 172 of the
  // usernames on file. this check must not.
  it("rejects the 12-character usernames that fool ObjectId.isValid", () => {
    expect(looksLikeId("Amanda Meyer")).toBe(false);
    expect(looksLikeId("koishitivity")).toBe(false);
    expect(looksLikeId("totallynotxy")).toBe(false);
    expect(looksLikeId("aya")).toBe(false);
  });
});

describe("baseSlugFor", () => {
  it("hands back the slug for an ordinary name", () => {
    expect(baseSlugFor("Reimu")).toBe("reimu");
  });

  it("refuses a name the filter rejects, so no slur reaches a url", () => {
    expect(baseSlugFor("Nigger")).toBeUndefined();
  });

  it("refuses a name that slugifies to nothing", () => {
    expect(baseSlugFor("오정남")).toBeUndefined();
  });
});

describe("reserved words", () => {
  it("holds the api's own segments", () => {
    for (const word of ["me", "inventory", "transactions", "badges", "notifications"]) {
      expect(RESERVED.has(word)).toBe(true);
    }
  });
});

describe("qualifiedSlug", () => {
  // two cases hold a character of the same name, and the case is what tells them apart
  it("names the case when two items share a name", () => {
    expect(qualifiedSlug("Saki", "Kivotos Case")).toBe("saki-kivotos-case");
    expect(qualifiedSlug("Hina", "Gehenna Case")).toBe("hina-gehenna-case");
  });

  // a qualifier cut mid-word names nothing, so the caller falls back to a number
  it("refuses a qualifier that would not fit", () => {
    expect(
      qualifiedSlug("Souvenir AWP | Dragon Lore", "Boston 2018 Cobblestone Souvenir Package")
    ).toBeNull();
  });

  it("refuses to qualify when there is nothing to qualify with", () => {
    expect(qualifiedSlug("Saki", null)).toBeNull();
    expect(qualifiedSlug("Saki", undefined)).toBeNull();
  });
});
