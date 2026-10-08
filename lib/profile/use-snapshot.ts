"use client";

import { useMemo } from "react";
import { buildSnapshot, type Snapshot } from "../engine/snapshot.ts";
import { useProfileHydrated, useProfileStore } from "./store.ts";

/**
 * The student's snapshot, indexed once per profile change.
 * Undefined while the profile is still loading from the browser, and null when there is no profile with courses.
 */
export function useSnapshot(): Snapshot | null | undefined {
  const hydrated = useProfileHydrated();
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  return useMemo(() => {
    if (!hydrated) return undefined;
    return records.length > 0 || plan.length > 0
      ? buildSnapshot(records, plan)
      : null;
  }, [hydrated, records, plan]);
}
