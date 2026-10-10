import { useSyncExternalStore } from "react";

/** Below 768px. */
export const PHONE = "(max-width: 767px)";

/** Whether a media query matches, kept in step as the window resizes. False on the server. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
