import i18n from "../../i18n";

// how long is left, in the largest unit that still says something useful
export const endsInLabel = (endsAt?: string): string | null => {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return i18n.t("predictions.ended");

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return i18n.t("predictions.endsInMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return i18n.t("predictions.endsInHours", { count: hours });
  return i18n.t("predictions.endsInDays", { count: Math.floor(hours / 24) });
};

// how long ago something happened, same idea in the other direction
export const agoLabel = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return i18n.t("predictions.secondsAgo", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return i18n.t("predictions.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("predictions.hoursAgo", { count: hours });
  return i18n.t("predictions.daysAgo", { count: Math.floor(hours / 24) });
};
