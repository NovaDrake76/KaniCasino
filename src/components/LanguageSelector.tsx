import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdCheck, MdExpandMore, MdLanguage } from "react-icons/md";
import Flag from "./Flag";
import { LANGUAGES, languageFor } from "../i18n/languages";

interface LanguageSelectorProps {
  // the footer needs a quiet control, the settings tab a full-width one
  compact?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const current = languageFor(i18n.language);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const pick = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${compact ? "" : "w-full max-w-sm"}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("settings.language")}
        className={`flex items-center gap-2 border border-line bg-surface-nav text-white transition-colors hover:border-line-strong ${
          compact ? "px-3 py-2 text-sm" : "w-full justify-between px-4 py-3"
        }`}
      >
        <span className="flex items-center gap-2">
          {compact ? <MdLanguage className="text-base text-ink-muted" /> : null}
          <Flag code={current.code} />
          <span>{current.name}</span>
        </span>
        <MdExpandMore className={`text-lg text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute z-50 flex max-h-72 flex-col overflow-y-auto border border-line bg-surface-nav shadow-lg ${
            compact ? "bottom-full right-0 mb-1 w-48" : "left-0 top-full mt-1 w-full"
          }`}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-raised ${
                l.code === current.code ? "text-white" : "text-ink-soft"
              }`}
            >
              <Flag code={l.code} />
              <span className="flex-1">{l.name}</span>
              {l.code === current.code && <MdCheck className="text-accent-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
