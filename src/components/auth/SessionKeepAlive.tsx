"use client";

import { useEffect } from "react";

const TOUCH_KEY = "synapse_session_touched_at";
const TOUCH_EVERY_MS = 12 * 60 * 60 * 1000;

/** Prolonge la session à l’ouverture, au plus toutes les 12 h. */
export function SessionKeepAlive() {
  useEffect(() => {
    const now = Date.now();
    try {
      const last = Number(window.sessionStorage.getItem(TOUCH_KEY) || "0");
      if (last && now - last < TOUCH_EVERY_MS) return;
      window.sessionStorage.setItem(TOUCH_KEY, String(now));
    } catch {
      // sessionStorage indisponible : on tente quand même une fois
    }

    void fetch("/api/auth/touch", {
      method: "POST",
      credentials: "same-origin",
    });
  }, []);

  return null;
}
