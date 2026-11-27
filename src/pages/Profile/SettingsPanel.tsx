import { useSearchParams } from "react-router-dom";
import LanguageSelector from "../../components/LanguageSelector";
import { resolveSection, SETTINGS_SECTIONS, SettingsSection } from "./tabs";
import SettingsCard from "./SettingsCard";
import NicknameSettings from "./NicknameSettings";
import AccountSettings from "./AccountSettings";
import SoundSettings from "./SoundSettings";
import DiscordSettings from "./DiscordSettings";
import EmailSettings from "./EmailSettings";
import i18n from "../../i18n";

const LABELS: Record<SettingsSection, string> = {
  account: "verify.settings.title",
  preferences: "settings.preferences",
  discord: "discord.settingsTitle",
  email: "auth.emailShort",
};

const SettingsPanel = () => {
  const [params, setParams] = useSearchParams();
  const section = resolveSection(params.get("section"), params.has("discord"));

  return (
    <div className="grid w-full max-w-[1100px] items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="grid grid-cols-2 bg-surface sm:grid-cols-4 md:grid-cols-1">
        {SETTINGS_SECTIONS.map((key) => {
          const active = section === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setParams({ tab: "settings", section: key }, { replace: true })}
              className={`w-full rounded-none border-0 border-l-[3px] px-4 py-3 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light ${
                active
                  ? "border-accent bg-surface-raised text-white hover:border-accent"
                  : "border-transparent bg-transparent text-ink-soft hover:border-transparent hover:text-white"
              }`}
            >
              {i18n.t(LABELS[key])}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        {section === "account" ? (
          <>
            <NicknameSettings />
            <AccountSettings />
          </>
        ) : section === "preferences" ? (
          <>
            <SettingsCard title={i18n.t("settings.language")}>
              <LanguageSelector />
            </SettingsCard>
            <SoundSettings />
          </>
        ) : section === "discord" ? (
          <DiscordSettings />
        ) : (
          <EmailSettings />
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
