import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { DEFAULT_LANGUAGE, LANGUAGES } from "./languages";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import vi from "./locales/vi.json";
import id from "./locales/id.json";

export const LANGUAGE_KEY = "kani.language";

const resources = { en, zh, ja, ko, es, pt, fr, de, it, vi, id };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(
      Object.entries(resources).map(([code, translation]) => [code, { translation }])
    ),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES.map((l) => l.code),
    // a browser asking for pt-BR or zh-Hans gets pt and zh rather than the fallback
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

const stampLang = (lng: string) => {
  document.documentElement.lang = lng;
};
i18n.on("languageChanged", stampLang);
// the detector has already run by the time this file finishes, so stamp the first one too
stampLang(i18n.language || DEFAULT_LANGUAGE);

export default i18n;
