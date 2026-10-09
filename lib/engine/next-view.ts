import type { CourseSummary } from "../catalogue/types.ts";
import type { EntryRoute, Term } from "../profile/types.ts";
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
  /** The catalogue text of each rule that needs a manual check. */
  checks: string[];
  /** False when every rule needs a check, so no course counts toward the group and its credits would read as zero. */
  counted: boolean;
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
  if (!course.terms.length && !course.parts?.length)
    return "Not offered this year";
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

const level = (course: CourseSummary) => Number.parseInt(course.number, 10);

// Suggestions stay undergraduate: graduate courses (600+) are left to the course browser.
const undergraduate = (s: Suggestion) => level(s.course) < 600;

/** Electives worth a look: 100 to 400 level courses with credits, the student's own subjects first and diploma or continuing studies subjects (FMT4, CPL2) last. */
function electives(suggestions: Suggestion[], snapshot: Snapshot): Entry[] {
  // Only courses actually taken at McGill, so CEGEP-credited courses don't steer the ranking.
  const subjects = new Set(
    [...snapshot.earned.keys(), ...snapshot.inProgress.keys()].map(
      (code) => code.split(" ")[0],
    ),
  );
  return suggestions
    .filter(
      (s) =>
        level(s.course) >= 100 &&
        level(s.course) < 500 &&
        (s.course.credits ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        Number(!subjects.has(a.course.subject)) -
          Number(!subjects.has(b.course.subject)) ||
        Number(/\d/.test(a.course.subject)) -
          Number(/\d/.test(b.course.subject)) ||
        level(a.course) - level(b.course) ||
        (a.course.code < b.course.code ? -1 : 1),
    )
    .map(asEntry);
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

const flatten = (items: (string | { oneOf: string[] })[]) =>
  items.flatMap((item) => (typeof item === "string" ? [item] : item.oneOf));

/** Everything the "What's next" page shows for one term. Pass a snapshot without the plan, so planned courses stay in the lists. */
export function nextView(
  catalogue: Catalogue,
  snapshot: Snapshot,
  term: Term,
  program: Program | null,
  entry: EntryRoute | null = null,
): NextView {
  const next = whatsNext(catalogue, snapshot, term, program, entry);
  const progress = program
    ? programProgress(program, snapshot, catalogue, { inProgress: true, entry })
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
            done &&
            !done.satisfied &&
            (namesCourses(group) || done.unparsed > 0)
            ? [{ group, done }]
            : [];
        })
      : [];
  // A course is listed once, under the first open group and rule that take it.
  const placed = openGroups.map(() => [] as Suggestion[]);
  for (const s of next.canTake.complementary.filter(undergraduate)) {
    const { code, credits } = s.course;
    const at = openGroups.findIndex(
      ({ group, done }) =>
        namesCourses(group) &&
        groupAllows(group, code) &&
        fitsCaps(group, done.rules, code, credits ?? 0),
    );
    placed[at]?.push(s);
  }
  // The rest of each listed rule follows, with why it is not open, so the whole list shows.
  const seen = new Set([
    ...next.canTake.complementary.map((s) => s.course.code),
    ...flatten(progress?.remaining ?? []),
  ]);
  const waiting = openGroups.map(() => [] as Entry[]);
  for (const { group } of openGroups) {
    for (const code of group.rules.flatMap((rule) => rule.courses ?? [])) {
      const course = catalogue.get(code);
      if (
        !course ||
        seen.has(code) ||
        level(course) >= 600 ||
        snapshot.done.has(code) ||
        snapshot.inProgress.has(code)
      ) {
        continue;
      }
      seen.add(code);
      const at = openGroups.findIndex(
        ({ group, done }) =>
          namesCourses(group) &&
          groupAllows(group, code) &&
          fitsCaps(group, done.rules, code, course.credits ?? 0),
      );
      waiting[at]?.push({
        course,
        uncertain: isUncertain(course),
        reason: reasonFor(course, term, snapshot),
      });
    }
  }
  const complementary = openGroups.flatMap(({ group, done }, i) => {
    const buckets = group.rules.map((rule, r) => ({
      rule,
      done: done.rules[r],
      entries: [] as Entry[],
    }));
    const rest: Entry[] = [];
    const entries = [
      ...(placed[i] ?? []).map(asEntry),
      ...(waiting[i] ?? []).sort((a, b) =>
        a.course.code < b.course.code ? -1 : 1,
      ),
    ];
    for (const entry of entries) {
      const bucket = buckets.find(
        (b) =>
          hostsCourses(b.rule, b.done) &&
          ruleMatches(b.rule, entry.course.code),
      );
      (bucket?.entries ?? rest).push(entry);
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
    const checks = group.rules.flatMap((rule) =>
      rule.unparsed ? [rule.title] : [],
    );
    return listed.length + checks.length > 0
      ? [
          {
            title: group.title,
            titled: group.rules.length > 1,
            creditsDone: Math.min(done.creditsDone, group.credits),
            credits: group.credits,
            buckets: listed,
            checks,
            counted: checks.length < group.rules.length,
          },
        ]
      : [];
  });

  return {
    progress,
    mustTake,
    later,
    complementary,
    other: electives(next.canTake.other, snapshot),
  };
}
