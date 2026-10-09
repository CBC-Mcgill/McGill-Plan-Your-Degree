import type { CourseSummary } from "../catalogue/types.ts";
import {
  type CourseRecord,
  type EntryRoute,
  earnsCredit,
  isDone,
  type Plan,
  type Term,
} from "../profile/types.ts";
import { type PendingCourse, settleParts } from "./parts.ts";

/** Courses by logical code. */
export type Catalogue = ReadonlyMap<string, CourseSummary>;

/** What a student has done, is doing, and has planned, indexed once so every lookup is a set hit. */
export interface Snapshot {
  /** Completed, transfer, exemption, or covered by a Science DEC. */
  done: ReadonlySet<string>;
  /** Credit-bearing done courses with the credits the record states. Null means use the catalogue. */
  earned: ReadonlyMap<string, number | null>;
  /** Registered now, with the term when known. A multi-term course with a part done and the rest missing counts as in progress. */
  inProgress: ReadonlyMap<string, Term | null>;
  /** Multi-term courses with some parts done and no credit yet. */
  pending: ReadonlyMap<string, PendingCourse>;
  planned: ReadonlySet<string>;
  /** Done plus in progress: what satisfies a prerequisite and what blocks through a restriction. */
  taken: ReadonlySet<string>;
  /** Science DEC equivalents in `done` that the student did not take at McGill. */
  covered: ReadonlySet<string>;
}

/** Courses a Quebec Science DEC covers at every CEGEP, from mcgill.ca/transfercredit/prospective/cegep. They meet prerequisites but carry no McGill credit. */
export const CEGEP_SCIENCE_EQUIVALENTS = [
  "BIOL 111",
  "CHEM 110",
  "CHEM 120",
  "MATH 133",
  "MATH 139",
  "MATH 140",
  "MATH 141",
  "PHYS 131",
  "PHYS 142",
];

export function buildSnapshot(
  records: readonly CourseRecord[],
  plan: Plan = [],
  entry: EntryRoute | null = null,
): Snapshot {
  const done = new Set<string>();
  const earned = new Map<string, number | null>();
  const inProgress = new Map<string, Term | null>();
  const pending = new Map<string, PendingCourse>();
  for (const record of records) {
    if (record.part) continue;
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
  for (const [code, parts] of settleParts(records)) {
    if (!parts.finished) {
      inProgress.set(code, parts.term);
      if (parts.pending) pending.set(code, parts.pending);
    } else {
      done.add(code);
      if (parts.earns) earned.set(code, parts.credits);
    }
  }
  const covered = new Set(
    entry === "cegep"
      ? CEGEP_SCIENCE_EQUIVALENTS.filter(
          (code) => !done.has(code) && !inProgress.has(code),
        )
      : [],
  );
  for (const code of covered) done.add(code);
  // A multi-term course with a part still running is not done yet.
  for (const code of inProgress.keys()) {
    done.delete(code);
    earned.delete(code);
  }
  return {
    done,
    earned,
    inProgress,
    pending,
    planned: new Set(plan.flatMap((entry) => entry.courses)),
    taken: new Set([...done, ...inProgress.keys()]),
    covered,
  };
}
