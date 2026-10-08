const EVENT = "synapse-trip-focus";

export function setTripFocusActive(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) document.documentElement.dataset.tripFocus = "1";
  else delete document.documentElement.dataset.tripFocus;
  window.dispatchEvent(new Event(EVENT));
}

export function isTripFocusActive() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.tripFocus === "1";
}

export function subscribeTripFocus(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
