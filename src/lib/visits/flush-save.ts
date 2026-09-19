/** Émis par la bottom nav « Sauvegarder » sur une page visite. */
export const VISIT_FLUSH_SAVE_EVENT = "synapse:visit-flush-save";

export function requestVisitFlushSave() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VISIT_FLUSH_SAVE_EVENT));
}
