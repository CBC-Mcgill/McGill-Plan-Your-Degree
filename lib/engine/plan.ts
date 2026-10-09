import type { CoursePart } from "../catalogue/types.ts";
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
  | { kind: "credit-limit"; term: Term; credits: number; limit: number }
  | { kind: "after-graduation"; term: Term; course: string; ends: Term };

/** What a planned course holds in one term. A multi-term course has one load per part, all tied to the term it starts in. */
export interface PlannedLoad {
  code: string;
  term: Term;
  /** The term the plan starts the course in. */
  start: Term;
  credits: number;
  /** 1-based, so a second half is part 2. */
  part: number;
  parts: number;
}

/** The next Fall or Winter term after a term key. */
const nextTermKey = (key: number) =>
  termFromKey(key + 1).season === "Summer" ? key + 2 : key + 1;

/** Every planned course as loads: one in its term, or one per part in the Fall and Winter terms from its start. Codes the catalogue lacks are skipped. */
export function planLoads(plan: Plan, catalogue: Catalogue): PlannedLoad[] {
  return plan.flatMap(({ term: start, courses }) =>
    courses.flatMap((code): PlannedLoad[] => {
      const course = catalogue.get(code);
      if (!course) return [];
      if (!course.parts?.length) {
        const credits = course.credits ?? 0;
        return [{ code, term: start, start, credits, part: 1, parts: 1 }];
      }
      const routes = new Map<string, CoursePart[]>();
      for (const part of course.parts) {
        const route = part.code.slice(-2, -1);
        routes.set(route, [...(routes.get(route) ?? []), part]);
      }
      const digit = (part: CoursePart) => Number(part.code.slice(-1));
      const options = [...routes.values()];
      const chosen =
        options.find((parts) =>
          parts.some(
            (part) =>
              digit(part) === 1 &&
              part.terms.some((term) => term.startsWith(start.season)),
          ),
        ) ??
        options[0] ??
        [];
      let key = termKey(start);
      return chosen
        .sort((a, b) => digit(a) - digit(b))
        .map((part, i) => {
          if (i > 0) key = nextTermKey(key);
          return {
            code,
            term: termFromKey(key),
            start,
            credits: part.credits ?? 0,
            part: i + 1,
            parts: chosen.length,
          };
        });
    }),
  );
}

/** The credits the plan holds in a term, counting any part of a multi-term course that falls in it. */
export function termLoad(plan: Plan, catalogue: Catalogue, term: Term): number {
  return planLoads(plan, catalogue)
    .filter((load) => termKey(load.term) === termKey(term))
    .reduce((sum, load) => sum + load.credits, 0);
}

/** Non-blocking plan problems. Prerequisites count done courses, earlier in-progress courses, and plan courses that finished in an earlier term, corequisites also the same term. */
export function planWarnings(
  plan: Plan,
  snapshot: Snapshot,
  catalogue: Catalogue,
  creditLimit = 17,
  graduation: Term | null = null,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const placed = new Set(plan.flatMap((entry) => entry.courses));
  const earlier = new Set(snapshot.done);
  const loads = planLoads(plan, catalogue);
  // The last part comes last in loads, so it wins.
  const ends = new Map(loads.map((load) => [load.code, load]));
  const ordered = [...plan];
  for (const { term } of loads) {
    if (!ordered.some((entry) => termKey(entry.term) === termKey(term))) {
      ordered.push({ term, courses: [] });
    }
  }
  ordered.sort((a, b) => compareTerms(a.term, b.term));
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

    for (const code of courses) {
      const course = catalogue.get(code);
      if (!course) continue;
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
      const last = ends.get(code);
      if (graduation && last && compareTerms(last.term, graduation) > 0) {
        warnings.push({
          kind: "after-graduation",
          term,
          course: code,
          ends: last.term,
        });
      }
    }
    const credits = loads
      .filter((load) => termKey(load.term) === key)
      .reduce((sum, load) => sum + load.credits, 0);
    if (credits > creditLimit) {
      warnings.push({
        kind: "credit-limit",
        term,
        credits,
        limit: creditLimit,
      });
    }
    for (const entry of plan) {
      for (const code of entry.courses) {
        const end = ends.get(code)?.term ?? entry.term;
        if (termKey(end) === key) earlier.add(code);
      }
    }
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
