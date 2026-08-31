import i18n from "../../i18n";

// five lines, because a wall of rules is read by nobody and there is no moderator here to
// argue the fine print with. the first four are what the server already enforces or what a
// report is for; the last one exists because support questions in a room this small go
// unanswered for hours.
export const RULE_KEYS = ["respect", "begging", "spam", "promo", "support"] as const;

const ChatRules = ({ onClose }: { onClose: () => void }) => (
  <div className="border-t border-line bg-surface-nav px-3 py-3">
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {i18n.t("chat.rulesTitle")}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label={i18n.t("chat.rulesClose")}
        className="p-0 text-ink-faint hover:text-ink-soft"
      >
        x
      </button>
    </div>
    <ol className="mt-2 flex list-none flex-col gap-1.5">
      {RULE_KEYS.map((key, i) => (
        <li key={key} className="flex gap-2 text-[12px] leading-snug text-ink-soft">
          <span className="flex-shrink-0 tabular-nums text-ink-faint">{i + 1}.</span>
          {i18n.t(`chat.rules.${key}`)}
        </li>
      ))}
    </ol>
  </div>
);

export default ChatRules;
