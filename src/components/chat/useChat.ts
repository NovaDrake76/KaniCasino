import { useCallback, useContext, useEffect, useRef, useState } from "react";
import UserContext from "../../UserContext";
import {
  ChatMessage,
  onHistory,
  onMessage,
  onRemoved,
  reportMessage,
  requestHistory,
  sendMessage,
} from "../../services/chat/ChatService";

// the panel never holds more than the server hands out, so a long session cannot grow the
// tab's memory the way an append-forever list would
const KEEP = 80;

export const useChat = (open: boolean) => {
  const { userData } = useContext(UserContext);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    const offHistory = onHistory((rows) => {
      setMessages(rows.slice(-KEEP));
      setLoaded(true);
    });
    const offMessage = onMessage((m) =>
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m].slice(-KEEP)))
    );
    const offRemoved = onRemoved(({ id }) => setMessages((prev) => prev.filter((m) => m.id !== id)));
    return () => {
      offHistory();
      offMessage();
      offRemoved();
    };
  }, []);

  // asked for once, the first time it is opened: a player who never opens the panel never
  // costs the server a history read
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    requestHistory();
  }, [open]);

  const send = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body) return true;
    setSending(true);
    const result = await sendMessage(body);
    setSending(false);
    setError(result.error ? result.error : null);
    return !result.error;
  }, []);

  const report = useCallback((id: string) => reportMessage(id), []);

  return { messages, loaded, error, sending, send, report, clearError: () => setError(null), me: userData };
};

export default useChat;
