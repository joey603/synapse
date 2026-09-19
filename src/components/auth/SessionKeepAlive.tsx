"use client";

import { useEffect } from "react";

/** Prolonge la session à l’ouverture de l’app, puis une fois par jour. */
export function SessionKeepAlive() {
  useEffect(() => {
    const touch = () => {
      void fetch("/api/auth/touch", {
        method: "POST",
        credentials: "same-origin",
      });
    };

    touch();
    const id = window.setInterval(touch, 24 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
