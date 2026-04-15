export const HISTORY_CHANGED_EVENT = "ppt-history-changed";

export function notifyHistoryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HISTORY_CHANGED_EVENT));
}
