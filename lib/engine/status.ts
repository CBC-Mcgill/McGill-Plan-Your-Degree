import type { Course, RequirementTree } from "../catalogue/types.ts";
import type { Season } from "../profile/types.ts";
import type { Snapshot } from "./snapshot.ts";

export type BrowseStatus =
  | "completed"
  | "in-progress"
  | "planned"
  | "available"
  | "locked";

export interface CourseState {
  status: BrowseStatus;
  /** True when the requirement text has conditions the tree cannot express, so the UI should say "check the requirement text". */
  uncertain: boolean;
  /** Taken courses that block this one through a restriction. */
  blockedBy: readonly string[];
}

const NONE: readonly string[] = [];

/** True when the tree is met by the codes. No tree means nothing is required. */
export function meets(
  tree: RequirementTree | null | undefined,
  codes: ReadonlySet<string>,
): boolean {
  if (tree === null || tree === undefined) return true;
  if (typeof tree === "string") return codes.has(tree);
  if ("and" in tree) return tree.and.every((child) => meets(child, codes));
  return tree.or.some((child) => meets(child, codes));
}

export function blockedBy(
  course: Course,
  taken: ReadonlySet<string>,
): readonly string[] {
  const excludes = course.restrictions?.excludes;
  if (!excludes?.length) return NONE;
  return excludes.filter((code) => taken.has(code));
}

export function isUncertain(course: Course): boolean {
  return Boolean(
    course.prerequisites?.unparsed || course.corequisites?.unparsed,
  );
}

/** Seasons are matched because the catalogue lists only the current year's terms. */
export function isOffered(course: Course, season: Season): boolean {
  // A multi-term course can start only in the term its first part (D1, N1) runs.
  const starts = course.parts?.filter((part) => part.code.endsWith("1"));
  const terms = starts?.length
    ? starts.flatMap((part) => part.terms)
    : course.terms;
  return terms.some((term) => term.startsWith(season));
}

/** The student's status for one course now, for the browse and course pages. */
export function courseStatus(course: Course, snapshot: Snapshot): CourseState {
  const uncertain = isUncertain(course);
  if (snapshot.done.has(course.code)) {
    return { status: "completed", uncertain: false, blockedBy: NONE };
  }
  if (snapshot.inProgress.has(course.code)) {
    return { status: "in-progress", uncertain: false, blockedBy: NONE };
  }
  const blocked = blockedBy(course, snapshot.taken);
  if (snapshot.planned.has(course.code)) {
    return { status: "planned", uncertain, blockedBy: blocked };
  }
  const open =
    blocked.length === 0 && meets(course.prerequisites?.tree, snapshot.taken);
  return {
    status: open ? "available" : "locked",
    uncertain,
    blockedBy: blocked,
  };
}
