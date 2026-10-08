import type { CourseSummary } from "../catalogue/types.ts";
import type { Term } from "../profile/types.ts";
import type { Program, Rule } from "../programs/types.ts";
import { type Suggestion, whatsNext } from "./next.ts";
import {
  fitsCaps,
  groupAllows,
  namesCourses,
  type ProgramProgress,
  programProgress,
  type RuleProgress,
  ruleMatches,
} from "./progress.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";
import {
  blockedBy,
  isOffered,
  isUncertain,
  meets,
  missingText,
} from "./status.ts";

export interface Entry {
  course: CourseSummary;
  uncertain: boolean;
  /** Why the student cannot take it in the term, for courses that are required later. */
  reason?: string;
}

export type Item = Entry | { oneOf: Entry[] };

export interface Bucket {
  title: string;
  /** "3 of 6 credits", when the rule states a minimum. */
  progress: string | null;
  entries: Entry[];
}

export interface OpenGroup {
  title: string;
  /** True when the group has several rules, so each list needs its rule title. */
  titled: boolean;
  creditsDone: number;
  credits: number;
  buckets: Bucket[];
}

export interface NextView {
  progress: ProgramProgress | null;
  mustTake: Item[];
  later: Item[];
  complementary: OpenGroup[];
  other: Entry[];
}

const asEntry = ({ course, uncertain }: Suggestion): Entry => ({
  course,
  uncertain,
});

function reasonFor(
  course: CourseSummary,
  term: Term,
  snapshot: Snapshot,
): string | undefined {
  if (!isOffered(course, term.season)) return `Not offered in ${term.season}`;
  const blocked = blockedBy(course, snapshot.taken);
  if (blocked.length > 0) {
    return `Not open to students who have taken ${blocked.join(", ")}`;
  }
  const tree = course.prerequisites?.tree;
  if (tree && !meets(tree, snapshot.taken)) {
    return `Needs ${missingText(tree, snapshot.taken)} first`;
  }
}

const hasMinimum = (rule: Rule) =>
  rule.minCredits !== undefined || rule.minCourses !== undefined;

/** A rule that lists courses and can host them: one with a minimum still to meet, or a plain list. "Cannot both be taken" rules only cap. */
const hostsCourses = (rule: Rule, done: RuleProgress | undefined) =>
  hasMinimum(rule)
    ? !done?.satisfied
    : rule.maxCourses === undefined &&
      Boolean(rule.courses || rule.match?.subjects);

function minimumText(rule: Rule, done: RuleProgress | undefined) {
  if (rule.minCredits !== undefined) {
    return `${Math.min(done?.creditsDone ?? 0, rule.minCredits)} of ${rule.minCredits} credits`;
  }
  if (rule.minCourses !== undefined) {
    const have = Math.min(done?.coursesDone ?? 0, rule.minCourses);
    return `${have} of ${rule.minCourses} ${rule.minCourses === 1 ? "course" : "courses"}`;
  }
  return null;
}

/** Everything the "What's next" page shows for one term. Pass a snapshot without the plan, so planned courses stay in the lists. */
export function nextView(
  catalogue: Catalogue,
  snapshot: Snapshot,
  term: Term,
  program: Program | null,
): NextView {
  const next = whatsNext(catalogue, snapshot, term, program);
  const progress = program
    ? programProgress(program, snapshot, catalogue, { inProgress: true })
    : null;

  const takeable = new Map(next.mustTake.map((s) => [s.course.code, s]));
  const entryFor = (code: string): Entry[] => {
    const suggestion = takeable.get(code);
    const course = catalogue.get(code);
    if (suggestion) return [asEntry(suggestion)];
    return course
      ? [
          {
            course,
            uncertain: isUncertain(course),
            reason: reasonFor(course, term, snapshot),
          },
        ]
      : [];
  };
  const mustTake: Item[] = [];
  const later: Item[] = [];
  for (const item of progress?.remaining ?? []) {
    const codes = typeof item === "string" ? [item] : item.oneOf;
    const entries = codes.flatMap(entryFor);
    const [first] = entries;
    if (!first) continue;
    (codes.some((code) => takeable.has(code)) ? mustTake : later).push(
      typeof item === "string" ? first : { oneOf: entries },
    );
  }

  const openGroups =
    program && progress
      ? program.groups.flatMap((group, i) => {
          const done = progress.groups[i];
          return group.kind === "complementary" &&
            namesCourses(group) &&
            done &&
            !done.satisfied
            ? [{ group, done }]
            : [];
        })
      : [];
  // A course is listed once, under the first open group and rule that take it.
  const placed = openGroups.map(() => [] as Suggestion[]);
  for (const s of next.canTake.complementary) {
    const { code, credits } = s.course;
    const at = openGroups.findIndex(
      ({ group, done }) =>
        groupAllows(group, code) &&
        fitsCaps(group, done.rules, code, credits ?? 0),
    );
    placed[at]?.push(s);
  }
  const complementary = openGroups.flatMap(({ group, done }, i) => {
    const buckets = group.rules.map((rule, r) => ({
      rule,
      done: done.rules[r],
      entries: [] as Entry[],
    }));
    const rest: Entry[] = [];
    for (const s of placed[i] ?? []) {
      const bucket = buckets.find(
        (b) =>
          hostsCourses(b.rule, b.done) && ruleMatches(b.rule, s.course.code),
      );
      (bucket?.entries ?? rest).push(asEntry(s));
    }
    const listed: Bucket[] = buckets
      .filter((b) => b.entries.length > 0)
      .map((b) => ({
        title: b.rule.title,
        progress: minimumText(b.rule, b.done),
        entries: b.entries,
      }));
    if (rest.length > 0) {
      listed.push({ title: "Other options", progress: null, entries: rest });
    }
    return listed.length > 0
      ? [
          {
            title: group.title,
            titled: group.rules.length > 1,
            creditsDone: Math.min(done.creditsDone, group.credits),
            credits: group.credits,
            buckets: listed,
          },
        ]
      : [];
  });

  return {
    progress,
    mustTake,
    later,
    complementary,
    other: next.canTake.other.map(asEntry),
  };
}
