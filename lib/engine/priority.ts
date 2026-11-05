import type { CourseSummary, RequirementTree } from "../catalogue/types.ts";
import {
  type EntryRoute,
  logicalCode,
  type Plan,
  type Season,
  type Term,
} from "../profile/types.ts";
import type { ComplementaryGroup, Program } from "../programs/types.ts";
import { groupAllows, namesCourses, programStanding } from "./progress.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";
import { unmet } from "./stages.ts";
import { isOffered, leaves } from "./status.ts";

/** A program course still to take that needs another course first, or alongside. */
export interface Dependent {
  code: string;
  kind: "required" | "complementary";
  /** A corequisite can run in the same term. A prerequisite must finish first. */
  corequisite: boolean;
}

export interface Priority {
  /** The program's required, then complementary courses still to take whose prerequisites or corequisites name this course and are not met yet. */
  dependents: Dependent[];
  /** The latest Fall or Winter term the course can start in so the courses after it keep their place. Null when nothing that must happen waits on it. */
  latest: Term | null;
  /** The courses after it that set `latest`, each needing the one before: COMP 251, then COMP 360. The last one is required or planned. */
  chain: string[];
  /** The term the plan holds the last course of `chain` in, or null when that course is required and only has to fit by graduation. */
  planned: Term | null;
}

const NONE: Priority = {
  dependents: [],
  latest: null,
  chain: [],
  planned: null,
};

// Fall and Winter terms in order: Winter 2027 is 2 × 2027, Fall 2027 the one after. Summer counts as the Winter before it, so a Summer graduation keeps its Winter.
const toIndex = (term: Term) =>
  term.year * 2 + (term.season === "Fall" ? 1 : 0);
const fromIndex = (index: number): Term => ({
  season: index % 2 === 1 ? "Fall" : "Winter",
  year: Math.floor(index / 2),
});

/** A course the catalogue lists in no Fall or Winter term this year may still run, so any regular term can take it. */
function runs(course: CourseSummary, season: Season) {
  const listed = isOffered(course, "Fall") || isOffered(course, "Winter");
  return !listed || isOffered(course, season);
}

/** Terms a course takes from its start: two for D1 and D2, three for J1 to J3. */
const span = (course: CourseSummary | undefined) =>
  Math.max(1, course?.parts?.length ?? 0);

/**
 * For each course, what in the program still waits on it and how late it can start.
 * Needed courses are the required items left on an earned or in-progress basis and the undergraduate courses of each complementary group still open.
 * Prerequisites already met by taken or planned courses add no dependent, so an "or" a student has covered never names the other options.
 * Only what must happen sets a deadline: a planned course in its planned term, and a required course by graduation. A complementary course is a choice, so a chain of them alone sets none.
 * The latest term walks back through Fall and Winter terms the course runs in, ignoring credit limits.
 */
export function priorities(
  program: Program,
  snapshot: Snapshot,
  catalogue: Catalogue,
  plan: Plan,
  graduation: Term,
  entry: EntryRoute | null = null,
): (code: string) => Priority {
  const progress = programStanding(
    program,
    snapshot,
    catalogue,
    entry,
    "counting",
  );
  const needed = new Map<string, Dependent["kind"]>();
  const need = (code: string, kind: Dependent["kind"]) => {
    if (!needed.has(code) && catalogue.has(code) && !snapshot.taken.has(code)) {
      needed.set(code, kind);
    }
  };
  // Required courses that must fit by graduation. A "one of" item with several choices left sets no deadline, since the student can pick the one that fits, and a planned choice settles it.
  const mustFinish = new Set<string>();
  for (const { remaining } of progress.groups) {
    for (const item of remaining) {
      const options = (typeof item === "string" ? [item] : item.oneOf).filter(
        (code) => catalogue.has(code),
      );
      const chosen = options.filter((code) => snapshot.planned.has(code));
      const codes = chosen.length > 0 ? chosen : options;
      for (const code of codes) need(code, "required");
      if (codes.length === 1 && codes[0]) mustFinish.add(codes[0]);
    }
  }
  const open = program.groups.filter(
    (group, i): group is ComplementaryGroup =>
      group.kind === "complementary" &&
      namesCourses(group) &&
      !progress.groups[i]?.satisfied,
  );
  if (open.length > 0) {
    for (const course of catalogue.values()) {
      if (
        Number.parseInt(course.number, 10) < 600 &&
        open.some((group) => groupAllows(group, course.code))
      ) {
        need(course.code, "complementary");
      }
    }
  }

  const have = new Set([...snapshot.taken, ...snapshot.planned]);
  const waiting = new Map<string, Dependent[]>();
  const link = (
    tree: RequirementTree | null | undefined,
    dependent: Dependent,
  ) => {
    const missing = unmet(tree, have);
    if (missing === null) return;
    for (const leaf of new Set(leaves(missing).map(logicalCode))) {
      if (leaf === dependent.code) continue;
      const list = waiting.get(leaf) ?? [];
      // A course named as both counts as a prerequisite, the stricter of the two.
      if (!list.some((d) => d.code === dependent.code)) list.push(dependent);
      waiting.set(leaf, list);
    }
  };
  for (const [code, kind] of needed) {
    const course = catalogue.get(code);
    link(course?.prerequisites?.tree, { code, kind, corequisite: false });
    link(course?.corequisites?.tree, { code, kind, corequisite: true });
  }

  const plannedIn = new Map<string, Term>();
  for (const entry of plan) {
    for (const code of entry.courses) plannedIn.set(code, entry.term);
  }
  const end = toIndex(graduation);
  /** A latest start, true in `summer` only for a course planned in Summer, which its Winter still comes before. */
  interface Latest {
    index: number | null;
    summer: boolean;
    chain: string[];
  }
  const latest = new Map<string, Latest>();
  const visiting = new Set<string>();
  /** `cut` holds the courses a loop skipped because they were still being worked out further up, so a result that depends on them is never cached. */
  function latestOf(code: string): Latest & { cut: Set<string> } {
    const known = latest.get(code);
    if (known) return { ...known, cut: new Set() };
    const at = plannedIn.get(code);
    const cut = new Set<string>();
    let result: Latest;
    if (at !== undefined) {
      // A planned course keeps its term.
      result = {
        index: toIndex(at),
        summer: at.season === "Summer",
        chain: [],
      };
    } else {
      const course = catalogue.get(code);
      const length = span(course);
      // A required course must finish by graduation. Anything else is free unless what follows it is not.
      let bound = mustFinish.has(code) ? end - length + 1 : null;
      let chain: string[] = [];
      visiting.add(code);
      for (const dependent of waiting.get(code) ?? []) {
        // A loop of corequisites sets no bound.
        if (visiting.has(dependent.code)) {
          cut.add(dependent.code);
          continue;
        }
        const after = latestOf(dependent.code);
        for (const skipped of after.cut) cut.add(skipped);
        if (after.index === null) continue;
        const before = after.summer ? after.index : after.index - 1;
        const limit = dependent.corequisite ? after.index : before - length + 1;
        // A corequisite that only shares the last term still names what follows.
        if (
          bound === null ||
          limit < bound ||
          (limit === bound && chain.length === 0)
        ) {
          bound = limit;
          chain = [dependent.code, ...after.chain];
        }
      }
      visiting.delete(code);
      cut.delete(code);
      if (bound !== null && course && !runs(course, fromIndex(bound).season)) {
        bound--;
      }
      result = { index: bound, summer: false, chain };
    }
    if (cut.size === 0) latest.set(code, result);
    return { ...result, cut };
  }

  return (code) => {
    const dependents = waiting.get(code);
    if (!dependents?.length) return NONE;
    const { index, chain } = latestOf(code);
    const last = chain.at(-1);
    // Only what follows it sets a deadline worth showing, not its own place in the plan or by graduation.
    if (index === null || last === undefined) {
      return { dependents, latest: null, chain: [], planned: null };
    }
    return {
      dependents,
      latest: fromIndex(index),
      chain,
      planned: plannedIn.get(last) ?? null,
    };
  };
}

/** How soon the latest term comes: "late" before the next Fall or Winter term, "soon" within the next two, else null. */
export function urgency(priority: Priority, now: Term): "late" | "soon" | null {
  if (!priority.latest) return null;
  const next = toIndex(now) + 1;
  const latest = toIndex(priority.latest);
  return latest < next ? "late" : latest <= next + 1 ? "soon" : null;
}
