import {
  compareTerms,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "../profile/types.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";
import { isOffered, meets } from "./status.ts";

export type PlanWarning =
  | {
      kind: "prerequisite" | "corequisite";
      term: Term;
      course: string;
      /** True when the requirement text has conditions the tree cannot express. */
      uncertain: boolean;
    }
  | { kind: "not-offered"; term: Term; course: string }
  | { kind: "restriction"; term: Term; course: string; blockedBy: string[] }
  | { kind: "credit-limit"; term: Term; credits: number; limit: number };

/** Non-blocking plan problems. Prerequisites count done courses, earlier in-progress courses, and earlier plan terms, corequisites also the same term. */
export function planWarnings(
  plan: Plan,
  snapshot: Snapshot,
  catalogue: Catalogue,
  creditLimit = 17,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const placed = new Set(plan.flatMap((entry) => entry.courses));
  const earlier = new Set(snapshot.done);
  const ordered = [...plan].sort((a, b) => compareTerms(a.term, b.term));
  for (const { term, courses } of ordered) {
    const key = termKey(term);
    const before = new Set(earlier);
    const alongside = new Set(courses);
    for (const [code, when] of snapshot.inProgress) {
      const at = when ? termKey(when) : Number.NEGATIVE_INFINITY;
      if (at < key) before.add(code);
      else if (at === key) alongside.add(code);
    }
    for (const code of before) alongside.add(code);

    let credits = 0;
    for (const code of courses) {
      const course = catalogue.get(code);
      if (!course) continue;
      // ponytail: a multi-term course loads only its first term, spread D2 into the next term if the planner needs it.
      credits += course.parts?.[0]?.credits ?? course.credits ?? 0;
      if (!meets(course.prerequisites?.tree, before)) {
        warnings.push({
          kind: "prerequisite",
          term,
          course: code,
          uncertain: Boolean(course.prerequisites?.unparsed),
        });
      }
      if (!meets(course.corequisites?.tree, alongside)) {
        warnings.push({
          kind: "corequisite",
          term,
          course: code,
          uncertain: Boolean(course.corequisites?.unparsed),
        });
      }
      if (!isOffered(course, term.season)) {
        warnings.push({ kind: "not-offered", term, course: code });
      }
      const blocked = (course.restrictions?.excludes ?? []).filter(
        (other) =>
          other !== code && (snapshot.taken.has(other) || placed.has(other)),
      );
      if (blocked.length > 0) {
        warnings.push({
          kind: "restriction",
          term,
          course: code,
          blockedBy: blocked,
        });
      }
    }
    if (credits > creditLimit) {
      warnings.push({
        kind: "credit-limit",
        term,
        credits,
        limit: creditLimit,
      });
    }
    for (const code of courses) earlier.add(code);
  }
  return warnings;
}

/** Terms from the start term to the expected graduation term, both included. Summer is skipped unless asked for. */
export function termRange(start: Term, end: Term, summer = false): Term[] {
  const terms: Term[] = [];
  for (let key = termKey(start); key <= termKey(end); key++) {
    const term = termFromKey(key);
    if (summer || term.season !== "Summer") terms.push(term);
  }
  return terms;
}
