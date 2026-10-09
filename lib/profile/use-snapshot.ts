"use client";

import { useMemo } from "react";
import { buildSnapshot, type Snapshot } from "../engine/snapshot.ts";
import { isStarted } from "./started.ts";
import { useProfileHydrated, useProfileStore } from "./store.ts";

/**
 * The student's snapshot, indexed once per profile change.
 * Undefined while the profile is still loading from the browser, and null when the student has not started a profile.
 */
export function useSnapshot(): Snapshot | null | undefined {
  const hydrated = useProfileHydrated();
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const entry = useProfileStore((state) => state.entry);
  const standing = useProfileStore((state) => state.advancedStanding);
  const started = useProfileStore(isStarted);
  return useMemo(() => {
    if (!hydrated) return undefined;
    return started ? buildSnapshot(records, plan, entry, standing) : null;
  }, [hydrated, started, records, plan, entry, standing]);
}
