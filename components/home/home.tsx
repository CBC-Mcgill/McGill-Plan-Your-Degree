"use client";

import { Landing } from "@/components/home/landing";
import { useSnapshot } from "@/lib/profile/use-snapshot";

/** The landing for everyone. A student who already started sees it without the calls to start, and until the profile loads the first-paint script's `data-returning` hides them. */
export function Home({ stars }: { stars: number | null }) {
  const snapshot = useSnapshot();
  return (
    <Landing
      stars={stars}
      started={snapshot === undefined ? undefined : snapshot !== null}
    />
  );
}
