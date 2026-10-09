import type {
  CourseSummary,
  Requirement,
  RequirementTree,
  Restriction,
} from "../catalogue/types.ts";
import type { Season } from "../profile/types.ts";
import type { Snapshot } from "./snapshot.ts";

export type BrowseStatus =
  | "completed"
  | "covered"
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

/** The fields a status reads, so a page can send the browser these and not the whole summary. */
export interface StatusInput {
  code: string;
  prerequisites: Pick<Requirement, "tree" | "unparsed"> | null;
  corequisites: Pick<Requirement, "unparsed"> | null;
  restrictions: Pick<Restriction, "excludes"> | null;
}

export function toStatusInput({
  code,
  prerequisites,
  corequisites,
  restrictions,
}: StatusInput): StatusInput {
  return {
    code,
    prerequisites: prerequisites && {
      tree: prerequisites.tree,
      unparsed: prerequisites.unparsed,
    },
    corequisites: corequisites && { unparsed: corequisites.unparsed },
    restrictions: restrictions && { excludes: restrictions.excludes },
  };
}

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

/** What a tree still needs, in plain words: "COMP 250 or COMP 251", "MATH 222 and (COMP 250 or COMP 251)". */
export function missingText(
  tree: RequirementTree,
  codes: ReadonlySet<string>,
): string {
  if (typeof tree === "string") return tree;
  const [op, children] =
    "and" in tree ? (["and", tree.and] as const) : (["or", tree.or] as const);
  const parts = (
    op === "and" ? children.filter((c) => !meets(c, codes)) : children
  ).map((child) => ({
    text: missingText(child, codes),
    nested: typeof child !== "string" && !(op in child),
  }));
  return parts
    .map(({ text, nested }) =>
      nested && parts.length > 1 ? `(${text})` : text,
    )
    .join(` ${op} `);
}

export function blockedBy(
  course: StatusInput,
  taken: ReadonlySet<string>,
): readonly string[] {
  const excludes = course.restrictions?.excludes;
  if (!excludes?.length) return NONE;
  return excludes.filter((code) => taken.has(code));
}

export function isUncertain(course: StatusInput): boolean {
  return Boolean(
    course.prerequisites?.unparsed || course.corequisites?.unparsed,
  );
}

/** A multi-term course can start only in the term its first part (D1, N1) runs. */
function startTerms(course: Pick<CourseSummary, "terms" | "parts">) {
  const starts = course.parts?.filter((part) => part.code.endsWith("1"));
  return starts?.length ? starts.flatMap((part) => part.terms) : course.terms;
}

/** Seasons are matched because the catalogue lists only the current year's terms. */
export function isOffered(course: CourseSummary, season: Season): boolean {
  return startTerms(course).some((term) => term.startsWith(season));
}

/** The student's status for one course now, for the browse and course pages. */
export function courseStatus(
  course: StatusInput,
  snapshot: Snapshot,
): CourseState {
  const uncertain = isUncertain(course);
  if (snapshot.covered.has(course.code)) {
    return { status: "covered", uncertain: false, blockedBy: NONE };
  }
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

/** "Can take" in the browse view and on the course page (D33): open to the student, offered in the catalogue year such as "2026-2027", and undergraduate. */
export function canTakeNow(
  course: StatusInput & Pick<CourseSummary, "terms" | "parts" | "number">,
  snapshot: Snapshot,
  year: string,
): boolean {
  const years = year.split("-");
  return (
    courseStatus(course, snapshot).status === "available" &&
    startTerms(course).some((term) => years.includes(term.slice(-4))) &&
    /^[1-4]/.test(course.number)
  );
}
