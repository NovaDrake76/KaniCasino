// every language the site is offered in. `code` is what i18next stores and what the
// browser is matched against; `name` is deliberately in the language itself, because a
// player looking for their own language is not reading the current one.
export interface Language {
  code: string;
  name: string;
  english: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", english: "English" },
  { code: "zh", name: "中文", english: "Chinese" },
  { code: "ja", name: "日本語", english: "Japanese" },
  { code: "ko", name: "한국어", english: "Korean" },
  { code: "es", name: "Español", english: "Spanish" },
  { code: "pt", name: "Português", english: "Portuguese" },
  { code: "fr", name: "Français", english: "French" },
  { code: "de", name: "Deutsch", english: "German" },
  { code: "it", name: "Italiano", english: "Italian" },
  { code: "vi", name: "Tiếng Việt", english: "Vietnamese" },
  { code: "id", name: "Bahasa Indonesia", english: "Indonesian" },
];

export const DEFAULT_LANGUAGE = "en";

export const isSupported = (code?: string | null) =>
  !!code && LANGUAGES.some((l) => l.code === code);

// "pt-BR" and "zh-Hans-CN" both have to land on a language we actually ship
export const normalize = (code?: string | null): string => {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.toLowerCase().split("-")[0];
  return isSupported(base) ? base : DEFAULT_LANGUAGE;
};

export const languageFor = (code: string): Language =>
  LANGUAGES.find((l) => l.code === normalize(code)) || LANGUAGES[0];
