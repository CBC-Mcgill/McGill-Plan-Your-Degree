import type { CourseSummary, RequirementTree } from "../catalogue/types.ts";
import { defaultGraduation } from "../profile/term-options.ts";
import { lastTerm } from "../profile/terms.ts";
import {
  type CourseRecord,
  compareTerms,
  type EntryRoute,
  earnsCredit,
  isDone,
  type Plan,
  type Term,
  termKey,
} from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import {
  type PlannedLoad,
  type PlanWarning,
  planLoads,
  termRange,
} from "./plan.ts";
import { programProgress } from "./progress.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";
import { blockedBy, isOffered, meets } from "./status.ts";

/** Completed: every course done. Past: a finished term with failed or withdrawn courses. */
export type StageState = "completed" | "current" | "past" | "planned" | "empty";

/** One term on the term path. */
export interface Stage {
  term: Term;
  key: number;
  state: StageState;
  /** Transcript and manual records of the term. */
  records: CourseRecord[];
  /** What the plan holds in the term, with later parts of multi-term courses first. */
  planned: PlannedLoad[];
  /** Parts a done part still needs in this term. */
  owed: MissingPart[];
  /** Credits earned, in progress, planned or owed. */
  credits: number;
  /** Courses that count: done, in progress, planned or owed. */
  count: number;
  warnings: PlanWarning[];
}

export type MissingPart = Extract<PlanWarning, { kind: "missing-part" }>;

/** The credits of the part a done part still needs. */
export function owedCredits(owed: MissingPart, catalogue: Catalogue): number {
  const code = owed.course + owed.part;
  return (
    catalogue.get(owed.course)?.parts?.find((part) => part.code === code)
      ?.credits ?? 0
  );
}

export function recordCredits(
  record: CourseRecord,
  catalogue: Catalogue,
): number {
  const course = catalogue.get(record.code);
  const code = record.code + (record.part ?? "");
  const part = course?.parts?.find((p) => p.code === code);
  return record.credits ?? part?.credits ?? course?.credits ?? 0;
}

export interface StageInput {
  records: readonly CourseRecord[];
  plan: Plan;
  startTerm: Term | null;
  graduationTerm: Term | null;
  entry: EntryRoute | null;
  catalogue: Catalogue;
  warnings: readonly PlanWarning[];
  now: Term;
}

/**
 * One stage per term from the start to graduation, Fall and Winter only.
 * Any other term holding a course, a plan, or a later part of a multi-term course, planned or owed, gets a stage too, so nothing the student saved is hidden.
 * Without a start the path begins at the earliest saved term, and without a graduation term it runs four years.
 */
export function buildStages(input: StageInput): { stages: Stage[]; end: Term } {
  const { records, plan, catalogue, now } = input;
  const nowKey = termKey(now);
  const saved = [
    ...records.flatMap((record) => record.term ?? []),
    ...plan.map((entry) => entry.term),
  ].sort(compareTerms);
  const start = input.startTerm ?? saved[0] ?? now;
  const end =
    input.graduationTerm ??
    defaultGraduation(start, input.entry, lastTerm(records), now);

  const loads = planLoads(plan, catalogue);
  const missing = input.warnings.filter(
    (w): w is MissingPart => w.kind === "missing-part",
  );
  const terms = new Map<number, Term>();
  for (const term of [
    ...termRange(start, end),
    ...saved,
    ...loads.map((load) => load.term),
    ...missing.map((owed) => owed.term),
  ]) {
    terms.set(termKey(term), term);
  }

  const stages = [...terms.values()].sort(compareTerms).map((term): Stage => {
    const key = termKey(term);
    const held = records.filter((r) => r.term && termKey(r.term) === key);
    const planned = loads
      .filter((load) => termKey(load.term) === key)
      .sort((a, b) => Number(b.part > 1) - Number(a.part > 1));
    const owed = missing.filter((w) => termKey(w.term) === key);
    const active = held.filter(
      (r) => r.status === "in-progress" || isDone(r.status),
    );
    const credits =
      held
        .filter((r) => r.status === "in-progress" || earnsCredit(r.status))
        .reduce((sum, r) => sum + recordCredits(r, catalogue), 0) +
      planned.reduce((sum, load) => sum + load.credits, 0) +
      owed.reduce((sum, w) => sum + owedCredits(w, catalogue), 0);
    const state: StageState =
      key === nowKey
        ? "current"
        : key > nowKey
          ? planned.length + owed.length + active.length > 0
            ? "planned"
            : "empty"
          : held.length === 0 && planned.length + owed.length === 0
            ? "empty"
            : held.length > 0 && held.every((r) => isDone(r.status))
              ? "completed"
              : "past";
    return {
      term,
      key,
      state,
      records: held,
      planned,
      owed,
      credits,
      count: active.length + planned.length + owed.length,
      warnings: input.warnings.filter((w) => termKey(w.term) === key),
    };
  });
  return { stages, end };
}

/**
 * The courses that count before a term starts, and also alongside it for corequisites.
 * Done courses, in-progress and planned courses of earlier terms, the same way planWarnings reads them.
 */
export function termContext(snapshot: Snapshot, plan: Plan, term: Term) {
  const key = termKey(term);
  const before = new Set(snapshot.done);
  const alongside = new Set<string>();
  for (const [code, when] of snapshot.inProgress) {
    const at = when ? termKey(when) : Number.NEGATIVE_INFINITY;
    if (at < key) before.add(code);
    else if (at === key) alongside.add(code);
  }
  for (const entry of plan) {
    const at = termKey(entry.term);
    if (at < key) for (const code of entry.courses) before.add(code);
    else if (at === key) for (const code of entry.courses) alongside.add(code);
  }
  for (const code of before) alongside.add(code);
  return { before, alongside };
}

/** The part of a requirement the codes do not meet, or null when it is met. */
export function unmet(
  tree: RequirementTree | null | undefined,
  have: ReadonlySet<string>,
): RequirementTree | null {
  if (tree === null || tree === undefined) return null;
  if (typeof tree === "string") return have.has(tree) ? null : tree;
  if ("and" in tree) {
    const rest = tree.and.flatMap((child) => unmet(child, have) ?? []);
    return rest.length > 1 ? { and: rest } : (rest[0] ?? null);
  }
  const rest = tree.or.map((child) => unmet(child, have));
  if (rest.includes(null)) return null;
  const options = rest.flatMap((child) => child ?? []);
  return options.length > 1 ? { or: options } : (options[0] ?? null);
}

/** Required courses the plan still lacks that run in the term's season and whose prerequisites earlier terms meet, in program order. */
export function suggestForTerm(
  program: Program,
  snapshot: Snapshot,
  catalogue: Catalogue,
  plan: Plan,
  term: Term,
  entry: EntryRoute | null = null,
): CourseSummary[] {
  const { remaining } = programProgress(program, snapshot, catalogue, {
    inProgress: true,
    planned: true,
    entry,
  });
  const { before } = termContext(snapshot, plan, term);
  const taken = new Set([...snapshot.taken, ...snapshot.planned]);
  const suggestions = new Map<string, CourseSummary>();
  for (const item of remaining) {
    for (const code of typeof item === "string" ? [item] : item.oneOf) {
      const course = catalogue.get(code);
      if (
        course &&
        isOffered(course, term.season) &&
        meets(course.prerequisites?.tree, before) &&
        blockedBy(course, taken).length === 0
      ) {
        suggestions.set(code, course);
      }
    }
  }
  return [...suggestions.values()];
}
