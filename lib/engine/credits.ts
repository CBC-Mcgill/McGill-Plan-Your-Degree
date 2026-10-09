import type { EntryRoute, Profile } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { creditedCredits } from "./progress.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";

/** Credits earned from completed and transfer courses, using the catalogue for records that do not state them. Advanced standing is not included. */
export function earnedCredits(
  snapshot: Snapshot,
  catalogue: Catalogue,
): number {
  let credits = 0;
  for (const [code, stated] of snapshot.earned) {
    credits += stated ?? catalogue.get(code)?.credits ?? 0;
  }
  return credits;
}

/** Credits of finished parts of multi-term courses that are not finished. They count once the last part is done. */
export function pendingCredits(snapshot: Snapshot): number {
  let credits = 0;
  for (const course of snapshot.pending.values()) credits += course.credits;
  return credits;
}

const BSC_CREDITS: Record<EntryRoute, number> = { cegep: 90, foundation: 120 };

/** The credits the whole degree needs: the stated total, else the program's for a B.Eng., else 90 or 120 for a B.Sc. by entry. Null when unknown. */
export function degreeCredits(
  creditsRequired: number | null,
  entry: EntryRoute | null,
  program: Program | null,
): number | null {
  if (creditsRequired !== null) return creditsRequired;
  if (program?.degree === "B.Eng.") return program.credits;
  if (program?.degree === "B.Sc." && entry) return BSC_CREDITS[entry];
  return null;
}

/** Credits from studies before McGill. A CEGEP lump sum on the transcript is the credit for the Year 0 groups, so the larger of the two counts, never both. */
export function standingCredits(
  advancedStanding: number,
  entry: EntryRoute | null,
  program: Program | null,
): number {
  return Math.max(advancedStanding, creditedCredits(entry, program));
}

export interface DegreeStanding {
  /** Completed and transfer credits plus `standingCredits`. */
  earned: number;
  inProgress: number;
  planned: number;
  pending: number;
  required: number | null;
}

/** Degree credits on every basis, for Home and the Profile. */
export function degreeStanding(
  snapshot: Snapshot,
  catalogue: Catalogue,
  profile: Pick<
    Profile,
    "records" | "plan" | "advancedStanding" | "creditsRequired" | "entry"
  >,
  program: Program | null,
): DegreeStanding {
  const credits = (code: string) => catalogue.get(code)?.credits ?? 0;
  return {
    earned:
      earnedCredits(snapshot, catalogue) +
      standingCredits(profile.advancedStanding, profile.entry, program),
    inProgress: profile.records
      .filter((record) => record.status === "in-progress")
      .reduce((sum, r) => sum + (r.credits ?? credits(r.code)), 0),
    planned: profile.plan
      .flatMap((entry) => entry.courses)
      .reduce((sum, code) => sum + credits(code), 0),
    pending: pendingCredits(snapshot),
    required: degreeCredits(profile.creditsRequired, profile.entry, program),
  };
}
