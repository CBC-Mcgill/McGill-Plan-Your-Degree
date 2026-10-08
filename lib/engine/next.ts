import type { Course } from "../catalogue/types.ts";
import type { Term } from "../profile/types.ts";
import type { ComplementaryGroup, Program } from "../programs/types.ts";
import {
  fitsCaps,
  type GroupProgress,
  groupAllows,
  namesCourses,
  programProgress,
} from "./progress.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";
import { blockedBy, isOffered, isUncertain, meets } from "./status.ts";

export interface Suggestion {
  course: Course;
  /** True when the requirement text has conditions the tree cannot express. */
  uncertain: boolean;
}

export interface WhatsNext {
  /** Remaining required courses of the program. */
  mustTake: Suggestion[];
  canTake: {
    /** Courses on a complementary list that still needs credits. */
    complementary: Suggestion[];
    other: Suggestion[];
  };
}

/** Courses the student can take in a term, in catalogue order. Prerequisites count done and in-progress courses. */
export function whatsNext(
  catalogue: Catalogue,
  snapshot: Snapshot,
  term: Term,
  program?: Program | null,
): WhatsNext {
  const required = new Set<string>();
  const openGroups: { group: ComplementaryGroup; progress: GroupProgress }[] =
    [];
  if (program) {
    const progress = programProgress(program, snapshot, catalogue, {
      inProgress: true,
      planned: true,
    });
    for (const item of progress.remaining) {
      for (const code of typeof item === "string" ? [item] : item.oneOf) {
        required.add(code);
      }
    }
    for (const [i, group] of program.groups.entries()) {
      const groupProgress = progress.groups[i];
      if (
        group.kind === "complementary" &&
        namesCourses(group) &&
        groupProgress &&
        !groupProgress.satisfied
      ) {
        openGroups.push({ group, progress: groupProgress });
      }
    }
  }

  const result: WhatsNext = {
    mustTake: [],
    canTake: { complementary: [], other: [] },
  };
  for (const course of catalogue.values()) {
    const code = course.code;
    if (
      snapshot.done.has(code) ||
      snapshot.inProgress.has(code) ||
      snapshot.planned.has(code) ||
      !isOffered(course, term.season) ||
      !meets(course.prerequisites?.tree, snapshot.taken) ||
      blockedBy(course, snapshot.taken).length > 0
    ) {
      continue;
    }
    const suggestion = { course, uncertain: isUncertain(course) };
    if (required.has(code)) result.mustTake.push(suggestion);
    else if (
      openGroups.some(
        ({ group, progress }) =>
          groupAllows(group, code) &&
          fitsCaps(group, progress.rules, code, course.credits ?? 0),
      )
    ) {
      result.canTake.complementary.push(suggestion);
    } else result.canTake.other.push(suggestion);
  }
  return result;
}
