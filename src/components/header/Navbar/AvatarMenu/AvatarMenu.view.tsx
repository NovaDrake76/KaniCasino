import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FiCheck, FiChevronDown, FiChevronRight, FiSettings } from "react-icons/fi";
import { MdLanguage } from "react-icons/md";
import { IoMdExit } from "react-icons/io";
import Avatar, { levelColor } from "../../../Avatar";
import Flag from "../../../Flag";
import { AvatarMenuViewProps } from "./AvatarMenu.types";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// the global button rule paints a rounded border on hover and a ring on focus, so every button here resets it
const reset = "rounded-none border-none hover:border-none focus:outline-none";
const row = `flex h-11 w-full items-center gap-3 px-4 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-white focus-visible:bg-surface ${reset}`;

const AvatarMenuView = ({
  userData, loading, size, open, place, triggerRef, cardRef, triggerProps, cardProps,
  xp, language, languages, languageOpen, toggleLanguages, pickLanguage, profilePath, settingsPath, logout, t,
}: AvatarMenuViewProps) => (
  <>
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t("avatarMenu.open")}
      className={`bg-transparent p-0 ${reset}`}
      {...triggerProps}
    >
      <Avatar image={userData?.profilePicture} loading={loading} id={userData?.id} size={size} level={userData?.level} showLevel noLink />
    </button>

    {open && !loading && createPortal(
      <div
        ref={cardRef}
        role="dialog"
        aria-label={t("avatarMenu.open")}
        style={{ top: place.top, right: place.right }}
        className="fixed z-overlay w-[296px] max-w-[calc(100vw-32px)] [filter:drop-shadow(0_18px_32px_rgba(0,0,0,0.55))]"
        {...cardProps}
      >
        <div className="notched-sm flex max-h-[calc(100vh-96px)] flex-col overflow-y-auto bg-surface-nav">
          <Link to={profilePath} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
            <Avatar image={userData?.profilePicture} id={userData?.id} size="medium" level={userData?.level} showLevel noLink />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold text-white">{userData?.username}</span>
              <span className="text-xs font-semibold" style={{ color: levelColor(userData?.level) }}>
                {t("avatarMenu.level", { n: userData?.level })}
              </span>
            </span>
            <span className="text-xs text-ink-muted">{t("avatarMenu.viewProfile")}</span>
            <FiChevronRight className="text-ink-faint" />
          </Link>

          <div className="flex flex-col gap-2 px-4 pb-4 pt-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">XP</span>
              <span className="text-xs tabular-nums text-ink-muted">
                <span className="font-semibold text-white">{fmt.format(xp.current)}</span> / {fmt.format(xp.next)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-line-strong">
              <div className="h-full bg-accent" style={{ width: `${xp.filled}%` }} />
            </div>
            <span className="text-xs text-ink-muted">{t("avatarMenu.toNext", { n: fmt.format(xp.toNext), level: xp.nextLevel })}</span>
          </div>

          <div className="border-t border-line py-1">
            <button type="button" onClick={toggleLanguages} aria-expanded={languageOpen} className={row}>
              <MdLanguage className="text-lg text-ink-faint" />
              <span className="flex-1 text-left">{t("settings.language")}</span>
              <Flag code={language.code} />
              <span className="text-xs text-ink-muted">{language.name}</span>
              <FiChevronDown className={`text-ink-faint transition-transform ${languageOpen ? "rotate-180" : ""}`} />
            </button>
            {languageOpen && (
              <div className="mx-4 mb-2 grid grid-cols-2 gap-px border border-line bg-line">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => pickLanguage(l.code)}
                    className={`flex items-center gap-2 bg-surface-nav px-3 py-2 text-xs transition-colors hover:bg-surface focus-visible:bg-surface ${reset} ${
                      l.code === language.code ? "text-white" : "text-ink-soft"
                    }`}
                  >
                    <Flag code={l.code} />
                    <span className="flex-1 truncate text-left">{l.name}</span>
                    {l.code === language.code && <FiCheck className="shrink-0 text-accent-gold" />}
                  </button>
                ))}
              </div>
            )}
            <Link to={settingsPath} className={row}>
              <FiSettings className="text-lg text-ink-faint" />
              <span className="flex-1">{t("settings.title")}</span>
              <FiChevronRight className="text-ink-faint" />
            </Link>
          </div>

          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={logout}
              className={`flex h-10 w-full items-center justify-center gap-2 bg-surface-raised text-sm font-semibold text-white transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover ${reset}`}
            >
              <IoMdExit className="text-lg" />
              {t("avatarMenu.logOut")}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
);

export default AvatarMenuView;
