import { KeyboardEvent, PointerEvent, RefObject } from "react";
import { TFunction } from "i18next";
import { Language } from "../../../../i18n/languages";
import { User } from "../../../Types";

export interface AvatarMenuProps {
  userData: User;
  loading: boolean;
  size: "small" | "medium";
  logout: () => void;
}

export interface XpSummary {
  current: number;
  next: number;
  // 0 to 100, how far into the level
  filled: number;
  toNext: number;
  nextLevel: number;
}

export interface AvatarMenuViewProps {
  userData: User;
  loading: boolean;
  size: "small" | "medium";
  open: boolean;
  // fixed offsets measured from the avatar when the card opens
  place: { top: number; right: number };
  triggerRef: RefObject<HTMLButtonElement>;
  cardRef: RefObject<HTMLDivElement>;
  triggerProps: {
    onPointerEnter: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerLeave: () => void;
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  };
  cardProps: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
  xp: XpSummary;
  language: Language;
  languages: Language[];
  languageOpen: boolean;
  toggleLanguages: () => void;
  pickLanguage: (code: string) => void;
  profilePath: string;
  settingsPath: string;
  logout: () => void;
  t: TFunction;
}
