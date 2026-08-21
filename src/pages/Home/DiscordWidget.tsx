import { useEffect, useState } from "react";
import { FaDiscord } from "react-icons/fa";
import Skeleton from "react-loading-skeleton";
import {
  getDiscordWidget,
  type DiscordWidget as Widget,
} from "../../services/discord/DiscordService";
import i18n from "../../i18n";

const GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID as string | undefined;
const INVITE = import.meta.env.VITE_DISCORD_INVITE as string | undefined;

// how many members the card lists. the list clips rather than growing, so this only
// needs to be more than the card can ever show at the table's height.
const SHOWN = 12;

const DOT: Record<string, string> = {
  online: "bg-green-400",
  idle: "bg-yellow-400",
  dnd: "bg-red-400",
  offline: "bg-gray-500",
};

const DiscordWidget = () => {
  const [widget, setWidget] = useState<Widget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!GUILD_ID) return setLoading(false);
    getDiscordWidget(GUILD_ID)
      .then(setWidget)
      .finally(() => setLoading(false));
  }, []);

  // the env invite is the stable one; the widget's own is a fallback if it is unset
  const invite = INVITE || widget?.instant_invite || null;
  if (!GUILD_ID || (!loading && !widget && !invite)) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <span className="px-1 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
        {i18n.t("home.joinTheDiscussion")}
      </span>

      <div className="flex flex-1 w-full flex-col gap-4 rounded-xl border border-line bg-[#16142A] p-5">
        <div className="flex items-center gap-3">
          <FaDiscord className="text-3xl text-[#5865F2]" />
          <div className="flex flex-col">
            <span className="font-bold leading-tight">
              {widget?.name || i18n.t("home.ourDiscord")}
            </span>
            {loading ? (
              <Skeleton
                width={80}
                height={12}
                baseColor="#1c1a31"
                highlightColor="#161427"
              />
            ) : (
              widget && (
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  {widget.presence_count} online
                </span>
              )
            )}
          </div>
        </div>

        {widget && widget.members.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            {widget.members.slice(0, SHOWN).map((m) => (
              <div key={m.id + m.username} className="flex items-center gap-2">
                <div className="relative shrink-0">
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-7 w-7 rounded-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-surface-nav" />
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#16142A] ${
                      DOT[m.status] || DOT.offline
                    }`}
                  />
                </div>
                <span className="truncate text-sm text-ink-soft">
                  {m.username}
                </span>
              </div>
            ))}
            {widget.presence_count > SHOWN && (
              <span className="text-xs text-ink-muted">
                and {widget.presence_count - SHOWN} more
              </span>
            )}
          </div>
        )}

        {invite && (
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center text-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-3 font-bold text-white transition-all hover:bg-[#4752C4]"
          >
            <FaDiscord className="text-xl" />
            {i18n.t("home.joinTheKanicasinoServer")}
          </a>
        )}
      </div>
    </div>
  );
};

export default DiscordWidget;
