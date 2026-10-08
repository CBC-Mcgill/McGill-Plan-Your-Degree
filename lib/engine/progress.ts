import type {
  ComplementaryGroup,
  Group,
  Match,
  Program,
  RequiredGroup,
  RequiredItem,
  Rule,
} from "../programs/types.ts";
import type { Catalogue, Snapshot } from "./snapshot.ts";

export interface CountOptions {
  /** Count courses in progress as if done. */
  inProgress?: boolean;
  /** Count planned courses as if done. */
  planned?: boolean;
}

export interface RuleProgress {
  title: string;
  creditsDone: number;
  coursesDone: number;
  minCredits?: number;
  minCourses?: number;
  satisfied: boolean;
}

export interface GroupProgress {
  title: string;
  kind: "required" | "complementary";
  /** Credits the group needs. */
  credits: number;
  creditsDone: number;
  minCourses?: number;
  coursesDone: number;
  satisfied: boolean;
  /** The counted courses this group claimed. */
  courses: string[];
  /** Required groups: the items still missing. */
  remaining: RequiredItem[];
  /** Complementary groups: one entry per rule. */
  rules: RuleProgress[];
}

export interface ProgramProgress {
  credits: number;
  /** Credits across groups, each group capped at what it needs. */
  creditsDone: number;
  satisfied: boolean;
  /** In the same order as the program file. */
  groups: GroupProgress[];
  /** Every required item still missing, across required groups. */
  remaining: RequiredItem[];
}

function matchesMatch(match: Match, code: string): boolean {
  const space = code.indexOf(" ");
  if (match.subjects && !match.subjects.includes(code.slice(0, space))) {
    return false;
  }
  const level = Math.floor(Number(code.slice(space + 1)) / 100) * 100;
  return (
    (match.minLevel === undefined || level >= match.minLevel) &&
    (match.maxLevel === undefined || level <= match.maxLevel) &&
    !match.exclude?.includes(code)
  );
}

export function ruleMatches(rule: Rule, code: string): boolean {
  return Boolean(
    rule.courses?.includes(code) ||
      (rule.match && matchesMatch(rule.match, code)),
  );
}

/** A rule that only filters, such as "at least 6 credits at the 400 level", and names no courses of its own. */
const isFilter = (rule: Rule) => !rule.courses && !rule.match?.subjects;

/** True when the group lists courses or subjects, false for "any department" groups like a free elective. */
export function namesCourses(group: ComplementaryGroup): boolean {
  return group.rules.some((rule) => !isFilter(rule));
}

/** The union of the rules that name courses. A group of only filters allows whatever they match. */
export function groupAllows(group: ComplementaryGroup, code: string): boolean {
  const rules = namesCourses(group)
    ? group.rules.filter((rule) => !isFilter(rule))
    : group.rules;
  return rules.some((rule) => ruleMatches(rule, code));
}

/** True when one more course stays within the caps of every rule it matches, given what each rule already holds, in rule order. */
export function fitsCaps(
  group: ComplementaryGroup,
  held: readonly Pick<RuleProgress, "creditsDone" | "coursesDone">[],
  code: string,
  credits: number,
): boolean {
  return group.rules.every((rule, i) => {
    const creditsDone = held[i]?.creditsDone ?? 0;
    const coursesDone = held[i]?.coursesDone ?? 0;
    return (
      !ruleMatches(rule, code) ||
      ((rule.maxCredits === undefined ||
        creditsDone + credits <= rule.maxCredits) &&
        (rule.maxCourses === undefined || coursesDone < rule.maxCourses))
    );
  });
}

function requiredProgress(
  group: RequiredGroup,
  have: ReadonlySet<string>,
  counted: ReadonlyMap<string, number>,
  used: Set<string>,
): GroupProgress {
  const remaining: RequiredItem[] = [];
  const courses: string[] = [];
  let creditsDone = 0;
  for (const item of group.courses) {
    const code = (typeof item === "string" ? [item] : item.oneOf).find((c) =>
      have.has(c),
    );
    if (code === undefined) {
      remaining.push(item);
    } else {
      used.add(code);
      courses.push(code);
      creditsDone += counted.get(code) ?? 0;
    }
  }
  return {
    title: group.title,
    kind: "required",
    credits: group.credits,
    creditsDone,
    coursesDone: courses.length,
    satisfied: remaining.length === 0,
    courses,
    remaining,
    rules: [],
  };
}

function complementaryProgress(
  group: ComplementaryGroup,
  counted: ReadonlyMap<string, number>,
  used: Set<string>,
): GroupProgress {
  const pool = new Map<string, number>();
  for (const [code, credits] of counted) {
    if (!used.has(code) && groupAllows(group, code)) pool.set(code, credits);
  }
  const state = group.rules.map((rule) => ({
    rule,
    creditsDone: 0,
    coursesDone: 0,
  }));
  const chosen = new Map<string, number>();
  let total = 0;

  const fits = (code: string, credits: number) =>
    fitsCaps(group, state, code, credits);
  const take = (code: string, credits: number) => {
    chosen.set(code, credits);
    total += credits;
    for (const s of state) {
      if (ruleMatches(s.rule, code)) {
        s.creditsDone += credits;
        s.coursesDone++;
      }
    }
  };

  // ponytail: greedy per group in file order with no backtracking, so a course two groups could use goes to the first. Upgrade to matching if real transcripts hit it.
  for (const s of state) {
    for (const [code, credits] of pool) {
      if (
        s.creditsDone >= (s.rule.minCredits ?? 0) &&
        s.coursesDone >= (s.rule.minCourses ?? 0)
      ) {
        break;
      }
      if (
        !chosen.has(code) &&
        ruleMatches(s.rule, code) &&
        fits(code, credits)
      ) {
        take(code, credits);
      }
    }
  }
  for (const [code, credits] of pool) {
    if (total >= group.credits && chosen.size >= (group.minCourses ?? 0)) break;
    if (!chosen.has(code) && fits(code, credits)) take(code, credits);
  }

  for (const code of chosen.keys()) used.add(code);
  const rules = state.map(({ rule, creditsDone, coursesDone }) => ({
    title: rule.title,
    creditsDone,
    coursesDone,
    minCredits: rule.minCredits,
    minCourses: rule.minCourses,
    satisfied:
      creditsDone >= (rule.minCredits ?? 0) &&
      coursesDone >= (rule.minCourses ?? 0),
  }));
  return {
    title: group.title,
    kind: "complementary",
    credits: group.credits,
    creditsDone: total,
    minCourses: group.minCourses,
    coursesDone: chosen.size,
    satisfied:
      total >= group.credits &&
      chosen.size >= (group.minCourses ?? 0) &&
      rules.every((rule) => rule.satisfied),
    courses: [...chosen.keys()],
    remaining: [],
    rules,
  };
}

/** Per group and per rule, what is done against what is needed. A course counts toward one group only, required groups first. */
export function programProgress(
  program: Program,
  snapshot: Snapshot,
  catalogue: Catalogue,
  count: CountOptions = {},
): ProgramProgress {
  const creditsOf = (code: string) => catalogue.get(code)?.credits ?? 0;
  // An exemption satisfies a required course but is never in `counted`, so it adds no credit.
  const have = new Set(snapshot.done);
  const counted = new Map<string, number>();
  for (const [code, credits] of snapshot.earned) {
    counted.set(code, credits ?? creditsOf(code));
  }
  const extra: Iterable<string>[] = [];
  if (count.inProgress) extra.push(snapshot.inProgress.keys());
  if (count.planned) extra.push(snapshot.planned);
  for (const codes of extra) {
    for (const code of codes) {
      have.add(code);
      if (!counted.has(code)) counted.set(code, creditsOf(code));
    }
  }

  const used = new Set<string>();
  const results = new Map<Group, GroupProgress>();
  for (const group of program.groups) {
    if (group.kind === "required") {
      results.set(group, requiredProgress(group, have, counted, used));
    }
  }
  for (const group of program.groups) {
    if (group.kind === "complementary") {
      results.set(group, complementaryProgress(group, counted, used));
    }
  }
  const groups = program.groups.flatMap((group) => results.get(group) ?? []);
  return {
    credits: program.credits,
    creditsDone: groups.reduce(
      (sum, group) => sum + Math.min(group.creditsDone, group.credits),
      0,
    ),
    satisfied: groups.every((group) => group.satisfied),
    groups,
    remaining: groups.flatMap((group) => group.remaining),
  };
}
