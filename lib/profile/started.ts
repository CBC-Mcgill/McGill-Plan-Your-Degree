import { useProfileStore } from "./store.ts";
import { currentTerm, defaultGraduation } from "./term-options.ts";
import type { Profile } from "./types.ts";

/** A student who imported, planned, picked a program or chose "start without a transcript" has a profile, even with no courses yet. */
export const isStarted = (
  profile: Pick<Profile, "records" | "plan" | "programId" | "startTerm">,
) =>
  profile.records.length > 0 ||
  profile.plan.length > 0 ||
  profile.programId !== null ||
  profile.startTerm !== null;

/** Begins an empty profile at the current term, for a student with no transcript. */
export function startProfile() {
  const start = currentTerm();
  useProfileStore.getState().setTerms({
    startTerm: start,
    graduationTerm: defaultGraduation(start),
  });
}
