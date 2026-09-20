import { KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LANGUAGES, languageFor } from "../../../../i18n/languages";
import { levelProgress, xpForLevel } from "../../../../utils/levelCurve";
import { AvatarMenuProps, XpSummary } from "./AvatarMenu.types";

// the pointer gets this long to cross from the avatar to the card before it folds
const CLOSE_DELAY = 180;
const GAP = 10;
const EDGE = 16;

export const xpSummary = (xp: number, level: number): XpSummary => {
  const next = xpForLevel(level + 1);
  return {
    current: xp,
    next,
    filled: Math.round(levelProgress(xp, level) * 100),
    toNext: Math.max(0, next - xp),
    nextLevel: level + 1,
  };
};

export const useAvatarMenu = ({ userData, loading, size, logout }: AvatarMenuProps) => {
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, right: EDGE });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closing = useRef<number>();
  const lastPointer = useRef("");
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const hold = () => window.clearTimeout(closing.current);
  const hide = useCallback(() => {
    window.clearTimeout(closing.current);
    setOpen(false);
    setLanguageOpen(false);
  }, []);
  const show = () => {
    hold();
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPlace({ top: r.bottom + GAP, right: Math.max(EDGE, window.innerWidth - r.right) });
    setOpen(true);
  };
  const leave = () => {
    hold();
    closing.current = window.setTimeout(hide, CLOSE_DELAY);
  };

  // the card is pinned to the viewport, so anything that moves the avatar out from under it closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const at = e.target as Node;
      if (triggerRef.current?.contains(at) || cardRef.current?.contains(at)) return;
      hide();
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(() => hide(), [location.pathname, location.search, hide]);

  const profilePath = `/profile/${userData?.id}`;
  const settingsPath = `${profilePath}?tab=settings`;

  const triggerProps = {
    onPointerEnter: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse") show();
    },
    onPointerLeave: leave,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      lastPointer.current = e.pointerType;
    },
    // a mouse already opened the card by hovering, so its click goes to the profile; a finger or the keyboard toggles
    onClick: () => {
      if (lastPointer.current === "mouse") {
        hide();
        navigate(profilePath);
      } else if (open) hide();
      else show();
      lastPointer.current = "";
    },
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        show();
      }
    },
  };

  const cardProps = { onPointerEnter: hold, onPointerLeave: leave };

  const pickLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setLanguageOpen(false);
  };

  return {
    userData,
    loading,
    size,
    open,
    place,
    triggerRef,
    cardRef,
    triggerProps,
    cardProps,
    xp: xpSummary(userData?.xp || 0, userData?.level || 0),
    language: languageFor(i18n.language),
    languages: LANGUAGES,
    languageOpen,
    toggleLanguages: () => setLanguageOpen((v) => !v),
    pickLanguage,
    profilePath,
    settingsPath,
    logout: () => {
      hide();
      logout();
    },
    t,
  };
};
