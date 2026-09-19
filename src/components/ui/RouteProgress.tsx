"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteProgress({ label }: { label: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);

  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(false);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      setPending(true);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!pending) return null;

  return (
    <div
      dir="ltr"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent-soft"
      role="progressbar"
      aria-label={label}
    >
      <div className="h-full w-1/3 animate-[synapse-loading_1s_ease-in-out_infinite] bg-accent" />
    </div>
  );
}
