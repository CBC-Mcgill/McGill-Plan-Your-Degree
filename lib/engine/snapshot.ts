import type { Course } from "../catalogue/types.ts";
import {
  type CourseRecord,
  earnsCredit,
  isDone,
  type Plan,
  type Term,
} from "../profile/types.ts";

/** Courses by logical code. */
export type Catalogue = ReadonlyMap<string, Course>;

/** What a student has done, is doing, and has planned, indexed once so every lookup is a set hit. */
export interface Snapshot {
  /** Completed, transfer, or exemption. */
  done: ReadonlySet<string>;
  /** Credit-bearing done courses with the credits the record states. Null means use the catalogue. */
  earned: ReadonlyMap<string, number | null>;
  /** Registered now, with the term when known. */
  inProgress: ReadonlyMap<string, Term | null>;
  planned: ReadonlySet<string>;
  /** Done plus in progress: what satisfies a prerequisite and what blocks through a restriction. */
  taken: ReadonlySet<string>;
}

export function buildSnapshot(
  records: readonly CourseRecord[],
  plan: Plan = [],
): Snapshot {
  const done = new Set<string>();
  const earned = new Map<string, number | null>();
  const inProgress = new Map<string, Term | null>();
  for (const record of records) {
    if (record.status === "in-progress") {
      inProgress.set(record.code, record.term);
    } else if (isDone(record.status)) {
      done.add(record.code);
      if (earnsCredit(record.status)) {
        const before = earned.get(record.code);
        earned.set(
          record.code,
          before === undefined
            ? record.credits
            : before === null || record.credits === null
              ? null
              : before + record.credits,
        );
      }
    }
  }
  // A multi-term course with one part still running is not done yet.
  for (const code of inProgress.keys()) {
    done.delete(code);
    earned.delete(code);
  }
  return {
    done,
    earned,
    inProgress,
    planned: new Set(plan.flatMap((entry) => entry.courses)),
    taken: new Set([...done, ...inProgress.keys()]),
  };
}
