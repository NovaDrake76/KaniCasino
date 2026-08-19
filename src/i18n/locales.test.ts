import { describe, it, expect } from "vitest";
import { LANGUAGES } from "./languages";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import italian from "./locales/it.json";
import vi from "./locales/vi.json";
import id from "./locales/id.json";

const locales: Record<string, unknown> = { en, zh, ja, ko, es, pt, fr, de, it: italian, vi, id };

const flatten = (node: unknown, prefix = ""): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string") out[`${prefix}${key}`] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
};

const english = flatten(en);

describe("translations", () => {
  it("ships a file for every language the selector offers", () => {
    for (const language of LANGUAGES) expect(locales[language.code]).toBeTruthy();
  });

  for (const [code, bundle] of Object.entries(locales)) {
    // a missing key silently falls back to english, which is worse than a failing test
    it(`${code} covers every key without inventing new ones`, () => {
      const keys = Object.keys(flatten(bundle));
      expect(keys.filter((k) => !(k in english))).toEqual([]);
      expect(Object.keys(english).filter((k) => !keys.includes(k))).toEqual([]);
    });
  }

  it("leaves no empty strings behind", () => {
    for (const [code, bundle] of Object.entries(locales)) {
      const blank = Object.entries(flatten(bundle)).filter(([, v]) => !v.trim());
      expect({ code, blank }).toEqual({ code, blank: [] });
    }
  });
});
