"use client";

import { useMemo } from "react";
import { useCatalogue } from "../catalogue/client.ts";
import type { Catalogue } from "../engine/snapshot.ts";
import { useProfileHydrated, useProfileStore } from "../profile/store.ts";
import { getProgram } from "../programs/index.ts";
import { type GameProgress, gameProgress } from "./progress.ts";

const NO_COURSES: Catalogue = new Map();

/** True once the profile has loaded and holds courses. Game UI waits for it, so nobody without a profile sees fake XP. */
export function useHasCourses(): boolean {
  const hydrated = useProfileHydrated();
  const any = useProfileStore((state) => state.records.length > 0);
  return hydrated && any;
}

/** XP, level and badges for the saved profile. Undefined until the profile and the catalogue have loaded. */
export function useGameProgress(): GameProgress | undefined {
  const hydrated = useProfileHydrated();
  const catalogue = useCatalogue();
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const programId = useProfileStore((state) => state.programId);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);

  return useMemo(() => {
    if (!hydrated || catalogue.status === "loading") return undefined;
    return gameProgress(
      { records, plan, graduationTerm, creditLimit },
      // Without the catalogue, only the credits a record states count.
      catalogue.status === "ready" ? catalogue.catalogue : NO_COURSES,
      (programId && getProgram(programId)) || null,
    );
  }, [
    hydrated,
    catalogue,
    records,
    plan,
    programId,
    graduationTerm,
    creditLimit,
  ]);
}
