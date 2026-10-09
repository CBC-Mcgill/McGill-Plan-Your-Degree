"use client";

import { useLayoutEffect } from "react";

/** Replaces the URL and keeps the history entry's scroll id. Next copies its own state and syncs the new URL. */
export function replaceUrl(url: string) {
  window.history.replaceState(
    { scrollId: window.history.state?.scrollId },
    "",
    url,
  );
}

/**
 * Back and Forward put the page where it was. The browser tries before Next has rendered the page,
 * while the document is still too short, so scroll is kept per history entry and restored on mount.
 */
export function useScrollMemory() {
  useLayoutEffect(() => {
    const known: string | undefined = window.history.state?.scrollId;
    const id = known ?? crypto.randomUUID();
    const key = `scroll:${id}`;
    let frame: number | undefined;
    if (known) {
      // Next scrolls to the top of the new page right after mount, so wait a frame.
      frame = requestAnimationFrame(() => {
        try {
          window.scrollTo(0, Number(sessionStorage.getItem(key)) || 0);
        } catch {
          // Storage can be blocked, and then Back simply opens at the top.
        }
      });
    } else {
      window.history.replaceState(
        { ...window.history.state, scrollId: id },
        "",
      );
    }
    let timer: number | undefined;
    // Leaving scrolls to the top just before unmount, so save only after a pause.
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(window.scrollY));
        } catch {
          // See above.
        }
      }, 150);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", save);
    };
  }, []);
}
