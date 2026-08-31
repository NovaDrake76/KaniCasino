import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiFlag } from "react-icons/fi";
import Player from "../Player";
import ChatBonus from "./ChatBonus";
import useChat from "./useChat";
import type { ChatMessage } from "../../services/chat/ChatService";
import i18n from "../../i18n";

const MAX_LENGTH = 200;

const stamp = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// timestamps are shown on purpose. with a small room a message can be hours old, and a feed
// that hides that is pretending to be busier than it is.
const Message = ({ message, onReport }: { message: ChatMessage; onReport: (id: string) => void }) => (
  <li className="group px-3 py-2 hover:bg-surface-nav">
    <div className="flex items-center gap-2">
      <Player user={message as never} size="small" />
      <span className="ml-auto flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums text-ink-faint">{stamp(message.at)}</span>
        <button
          type="button"
          onClick={() => onReport(message.id)}
          aria-label={i18n.t("chat.report")}
          className="p-0 text-ink-faint opacity-0 transition-opacity hover:text-accent-gold focus:opacity-100 group-hover:opacity-100"
        >
          <FiFlag className="text-xs" />
        </button>
      </span>
    </div>
    <p className="mt-1 break-words pl-1 text-[13px] leading-snug text-ink-soft">{message.text}</p>
  </li>
);

const ChatPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { messages, loaded, error, sending, send, report, clearError, me } = useChat(open);
  const [draft, setDraft] = useState("");
  const [reported, setReported] = useState<string | null>(null);
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
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
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

      <ChatBonus />

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
    </aside>
  );
};

export default ChatPanel;
