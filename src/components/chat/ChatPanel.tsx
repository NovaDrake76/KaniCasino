import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiFlag } from "react-icons/fi";
import { FaDiscord, FaGavel, FaTwitter } from "react-icons/fa";
import ChatRules from "./ChatRules";
import Avatar from "../Avatar";
import Badge from "../Badge";
import RainPool from "./RainPool";
import useChat from "./useChat";
import type { ChatMessage } from "../../services/chat/ChatService";
import i18n from "../../i18n";

const MAX_LENGTH = 200;
const X_URL = (import.meta.env.VITE_X_URL as string) || "https://x.com/kani_casino";
const DISCORD_URL = (import.meta.env.VITE_DISCORD_INVITE as string) || "https://discord.gg/NMdYb2aBZK";

const stamp = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// timestamps are shown on purpose. with a small room a message can be hours old, and a
// feed that hides that is pretending to be busier than it is.
//
// composed rather than reusing Player, which lays the avatar and the name out on one row.
// a chat needs the name and the message stacked beside the avatar, or a long line wraps
// back underneath the picture and the column stops reading as a conversation.
const Message = ({ message, onReport }: { message: ChatMessage; onReport: (id: string) => void }) => (
  <li className="group flex gap-2.5 px-3 py-2 hover:bg-surface-nav">
    <Link to={`/profile/${message._id}`} className="flex-shrink-0" tabIndex={-1} aria-hidden>
      <Avatar
        id={message._id}
        image={message.profilePicture || ""}
        size="small"
        level={message.level}
        showLevel
        noLink
      />
    </Link>

    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Badge badge={message.badge as never} linked={false} hoverCard={false} />
        <Link
          to={`/profile/${message._id}`}
          className="min-w-0 truncate text-[11px] font-bold leading-tight text-white hover:underline"
        >
          {message.username}
        </Link>
        <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums text-ink-faint">
          {stamp(message.at)}
        </span>
        <button
          type="button"
          onClick={() => onReport(message.id)}
          aria-label={i18n.t("chat.report")}
          className="flex-shrink-0 p-0 text-ink-faint opacity-0 transition-opacity hover:text-accent-gold focus:opacity-100 group-hover:opacity-100"
        >
          <FiFlag className="text-xs" />
        </button>
      </div>
      <p className="break-words text-[13px] leading-snug text-ink-soft">{message.text}</p>
    </div>
  </li>
);

const ChatPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { messages, loaded, error, sending, send, report, clearError, me } = useChat(open);
  const [draft, setDraft] = useState("");
  const [reported, setReported] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const foot = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // only follow the tail when they are already at it, so reading back is not yanked away
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (atEnd) foot.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  const notice = useMemo(() => {
    if (!error) return null;
    return i18n.t(`chat.errors.${error}`, { defaultValue: i18n.t("chat.errors.failed") });
  }, [error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !draft.trim()) return;
    if (await send(draft)) setDraft("");
  };

  const flag = async (id: string) => {
    await report(id);
    setReported(id);
    setTimeout(() => setReported(null), 2500);
  };

  return (
    <aside
      className={`flex h-full w-full flex-col bg-surface-deep lg:w-[300px] ${open ? "" : "hidden"}`}
      aria-label={i18n.t("chat.title")}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {i18n.t("chat.title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={i18n.t("chat.hide")}
          className="p-1 text-ink-faint hover:text-ink-soft"
        >
          <FiChevronLeft />
        </button>
      </div>

      <RainPool />

      <ul ref={list} className="flex-1 overflow-y-auto overflow-x-hidden">
        {!loaded && <li className="px-3 py-6 text-center text-xs text-ink-faint">{i18n.t("chat.loading")}</li>}
        {loaded && !messages.length && (
          <li className="px-3 py-6 text-center text-xs text-ink-faint">{i18n.t("chat.empty")}</li>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} onReport={flag} />
        ))}
        <div ref={foot} />
      </ul>

      {reported && (
        <div className="bg-surface-nav px-3 py-2 text-[11px] text-ink-muted">{i18n.t("chat.reported")}</div>
      )}
      {notice && (
        <button
          type="button"
          onClick={clearError}
          className="w-full bg-[#3a1f2a] px-3 py-2 text-left text-[11px] text-[#ffb4b4]"
        >
          {notice}
        </button>
      )}

      {showRules && <ChatRules onClose={() => setShowRules(false)} />}

      {me ? (
        <form onSubmit={submit} className="flex gap-1.5 border-t border-line p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={i18n.t("chat.placeholder")}
            maxLength={MAX_LENGTH}
            className="min-w-0 flex-1 bg-surface-nav px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:bg-surface"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="bg-secondary px-3 text-xs font-bold text-white hover:bg-secondary-light disabled:opacity-40"
          >
            {i18n.t("chat.send")}
          </button>
        </form>
      ) : (
        <Link to="/" className="border-t border-line px-3 py-3 text-center text-xs text-ink-muted hover:text-ink-soft">
          {i18n.t("chat.logInToTalk")}
        </Link>
      )}

      {/* the bar the reference puts under the input: where to find us, what the rules are,
          and the way out. the close control lives here rather than in the header, next to
          the arrow that brings it back. */}
      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X"
          className="p-1.5 text-ink-faint hover:text-ink-soft"
        >
          <FaTwitter className="text-sm" />
        </a>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
          className="p-1.5 text-ink-faint hover:text-ink-soft"
        >
          <FaDiscord className="text-sm" />
        </a>
        <button
          type="button"
          onClick={() => setShowRules((was) => !was)}
          aria-label={i18n.t("chat.rulesTitle")}
          aria-pressed={showRules}
          className={`p-1.5 ${showRules ? "text-accent-gold" : "text-ink-faint hover:text-ink-soft"}`}
        >
          <FaGavel className="text-sm" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={i18n.t("chat.hide")}
          className="ml-auto p-1.5 text-ink-faint hover:text-ink-soft"
        >
          <FiChevronLeft />
        </button>
      </div>
    </aside>
  );
};

export default ChatPanel;
