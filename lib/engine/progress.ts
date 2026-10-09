import { creditsText } from "../format.ts";
import type { EntryRoute } from "../profile/types.ts";
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
  /** How the student started. A Quebec CEGEP student is credited for the foundation groups. */
  entry?: EntryRoute | null;
}

/** A course a group or rule counted, with the credits it brought. */
export interface Claimed {
  code: string;
  credits: number;
}

export interface RuleProgress {
  title: string;
  creditsDone: number;
  coursesDone: number;
  /** The counted courses that match the rule. A course can match several rules of one group. */
  courses: Claimed[];
  minCredits?: number;
  minCourses?: number;
  /** The crawler could not read this rule, so nothing counts toward it and it is never satisfied. */
  unparsed?: true;
  satisfied: boolean;
}

export interface GroupProgress {
  title: string;
  kind: "required" | "complementary";
  /** Credits the group needs, less those of required courses met without credit, which move to the replace group. */
  credits: number;
  creditsDone: number;
  minCourses?: number;
  coursesDone: number;
  satisfied: boolean;
  /** A foundation group the student is credited for from CEGEP, so it needs no courses. */
  credited: boolean;
  /** The counted courses this group claimed. */
  courses: Claimed[];
  /** Required groups: the items still missing. */
  remaining: RequiredItem[];
  /** Complementary groups: one entry per rule. */
  rules: RuleProgress[];
  /** Rules in the group that need a manual check. Such a group is never satisfied. */
  unparsed: number;
  /** Only on the replace group: the required courses met without credit, with the catalogue credits it makes up for. */
  replaces?: Claimed[];
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
  /** Counted courses that no group claimed. They still count toward the degree's total credits. */
  unclaimed: Claimed[];
  /** Advanced standing credits that no group claimed, beyond the credited Year 0. */
  standing: number;
}

/** The code advanced standing claims under: earned credit with no course behind it. Only a group open to any course takes it. */
export const STANDING = "";

/** Title of the group that makes up the credits of required courses met without credit. */
export const REPLACE_TITLE = "Replace exempted credits";

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
  // ponytail: advanced standing has no subject or level, so it fits any rule that only filters, such as a 200-level elective.
  if (code === STANDING) return !rule.unparsed && isFilter(rule);
  return (
    !rule.unparsed &&
    Boolean(
      rule.courses?.includes(code) ||
        (rule.match && matchesMatch(rule.match, code)),
    )
  );
}

/** A rule that only filters, such as "at least 6 credits at the 400 level", and names no courses of its own. */
const isFilter = (rule: Rule) => !rule.courses && !rule.match?.subjects;

/** True when the group lists courses or subjects, false for "any department" groups like a free elective. */
export function namesCourses(group: ComplementaryGroup): boolean {
  return group.rules.some((rule) => !isFilter(rule));
}

const or = new Intl.ListFormat("en-GB", { type: "disjunction" });

/** Where a complementary group's credits come from, such as "List A or List B", read from its rule titles. Null when the titles do not read as plain names. */
export function creditSources(group: ComplementaryGroup): string | null {
  const names = [
    ...new Set(
      group.rules
        .filter(
          (rule) =>
            !rule.unparsed && !isFilter(rule) && rule.maxCourses === undefined,
        )
        .map((rule) => rule.title.replace(/,[\s\S]*/, "").trim()),
    ),
  ];
  // ponytail: a naming heuristic, since crawled titles are often "3 credits from the following" or "Complementary Courses".
  const plain =
    names.length > 0 &&
    names.length <= 3 &&
    names.every(
      (name) =>
        name !== "" &&
        name !== group.title &&
        !/[\d:]|complementary|elective/i.test(name),
    );
  return plain ? or.format(names) : null;
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

/** A Year 0 or Foundation group a Quebec CEGEP student is credited for, so it counts as done without courses. */
export const isCredited = (
  group: Group,
  entry: EntryRoute | null | undefined,
) => entry === "cegep" && group.foundation === true;

/** Credits of the Year 0 groups a Quebec CEGEP student is credited for. */
export function creditedCredits(
  entry: EntryRoute | null | undefined,
  program: Program | null,
): number {
  return (program?.groups ?? [])
    .filter((group) => isCredited(group, entry))
    .reduce((sum, group) => sum + group.credits, 0);
}

/** Full credits with nothing remaining. The group claims no courses, so a course the student did take can count elsewhere. */
function creditedProgress(group: Group): GroupProgress {
  return {
    title: group.title,
    kind: group.kind,
    credits: group.credits,
    creditsDone: group.credits,
    coursesDone: 0,
    satisfied: true,
    credited: true,
    courses: [],
    remaining: [],
    rules: [],
    unparsed: 0,
  };
}

/** An exemption or a Science DEC equivalent meets its item without credit, so its catalogue credits move to `replaces`. */
function requiredProgress(
  group: RequiredGroup,
  have: ReadonlySet<string>,
  counted: ReadonlyMap<string, number>,
  used: Set<string>,
  creditsOf: (code: string) => number,
  replaces: Claimed[],
): GroupProgress {
  const remaining: RequiredItem[] = [];
  const courses: Claimed[] = [];
  let creditsDone = 0;
  let moved = 0;
  for (const item of group.courses) {
    const codes = typeof item === "string" ? [item] : item.oneOf;
    const code =
      codes.find((c) => counted.has(c)) ?? codes.find((c) => have.has(c));
    if (code === undefined) {
      remaining.push(item);
    } else if (counted.has(code)) {
      const credits = counted.get(code) ?? 0;
      used.add(code);
      courses.push({ code, credits });
      creditsDone += credits;
    } else {
      courses.push({ code, credits: 0 });
      replaces.push({ code, credits: creditsOf(code) });
      moved += creditsOf(code);
    }
  }
  const credits = Math.max(0, group.credits - moved);
  return {
    title: group.title,
    kind: "required",
    credits,
    // A oneOf course with more credits than the catalogue heading assumed must not read 27 of 26.
    creditsDone: Math.min(creditsDone, credits),
    coursesDone: courses.length,
    satisfied: remaining.length === 0,
    credited: false,
    courses,
    remaining,
    rules: [],
    unparsed: 0,
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
    courses: [] as Claimed[],
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
        s.courses.push({ code, credits });
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
  const rules = state.map(({ rule, creditsDone, coursesDone, courses }) => ({
    title: rule.title,
    creditsDone,
    coursesDone,
    courses,
    minCredits: rule.minCredits,
    minCourses: rule.minCourses,
    unparsed: rule.unparsed,
    satisfied:
      !rule.unparsed &&
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
    credited: false,
    courses: [...chosen].map(([code, credits]) => ({ code, credits })),
    remaining: [],
    rules,
    unparsed: rules.filter((rule) => rule.unparsed).length,
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
  // A CEGEP lump sum is the credit for the credited Year 0 groups, so only what is left over can fill an elective.
  const standing = Math.max(
    0,
    snapshot.standing - creditedCredits(count.entry, program),
  );
  if (standing > 0) counted.set(STANDING, standing);
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
  const replaces: Claimed[] = [];
  const results = new Map<Group, GroupProgress>();
  const credited = (group: Group) => isCredited(group, count.entry);
  for (const group of program.groups) {
    if (credited(group)) {
      results.set(group, creditedProgress(group));
    } else if (group.kind === "required") {
      results.set(
        group,
        requiredProgress(group, have, counted, used, creditsOf, replaces),
      );
    }
  }
  for (const group of program.groups) {
    if (!credited(group) && group.kind === "complementary") {
      results.set(group, complementaryProgress(group, counted, used));
    }
  }
  const groups = program.groups.flatMap((group) => results.get(group) ?? []);
  const moved = replaces.reduce((sum, claimed) => sum + claimed.credits, 0);
  if (moved > 0) {
    // Last, so it takes only what no group of the program wanted. It stays after the program's groups, so their indexes still line up.
    const replace: ComplementaryGroup = {
      title: REPLACE_TITLE,
      kind: "complementary",
      credits: moved,
      rules: [{ title: "Any course", match: {} }],
    };
    groups.push({
      ...complementaryProgress(replace, counted, used),
      replaces,
    });
  }
  return {
    credits: program.credits,
    creditsDone: groups.reduce(
      (sum, group) => sum + Math.min(group.creditsDone, group.credits),
      0,
    ),
    satisfied: groups.every((group) => group.satisfied),
    groups,
    remaining: groups.flatMap((group) => group.remaining),
    unclaimed: [...counted]
      .filter(([code]) => !used.has(code) && code !== STANDING)
      .map(([code, credits]) => ({ code, credits })),
    standing: used.has(STANDING) ? 0 : standing,
  };
}

/** The three ways to count progress (D1): earned, earned or in progress, and with the plan. */
export type Basis = "earned" | "counting" | "plan";

export const BASIS: Record<Basis, Omit<CountOptions, "entry">> = {
  earned: {},
  counting: { inProgress: true },
  plan: { inProgress: true, planned: true },
};

/** Program progress on one basis. Pages call this, never `programProgress` with options of their own. */
export function programStanding(
  program: Program,
  snapshot: Snapshot,
  catalogue: Catalogue,
  entry: EntryRoute | null,
  basis: Basis,
): ProgramProgress {
  return programProgress(program, snapshot, catalogue, {
    ...BASIS[basis],
    entry,
  });
}

/** Credits by the status of the courses that earned them, for a `StatusBar`. */
export interface CreditSplit {
  completed: number;
  inProgress: number;
  planned: number;
}

/** A group's credits by the status of the courses it claimed, capped at what it needs: earned first, then in progress, then planned. Pass a group counted with the plan. */
export function creditSplit(
  group: Pick<GroupProgress, "credited" | "credits" | "courses">,
  snapshot: Snapshot,
): CreditSplit {
  if (group.credited) {
    return { completed: group.credits, inProgress: 0, planned: 0 };
  }
  let completed = 0;
  let inProgress = 0;
  let planned = 0;
  for (const { code, credits } of group.courses) {
    if (snapshot.inProgress.has(code)) inProgress += credits;
    else if (snapshot.planned.has(code)) planned += credits;
    else completed += credits;
  }
  let left = group.credits;
  const take = (credits: number) => {
    const taken = Math.min(credits, left);
    left -= taken;
    return taken;
  };
  return {
    completed: take(completed),
    inProgress: take(inProgress),
    planned: take(planned),
  };
}

/** A program's credits by status, the sum of its groups' splits. */
export function programSplit(
  progress: ProgramProgress,
  snapshot: Snapshot,
): CreditSplit {
  const total = { completed: 0, inProgress: 0, planned: 0 };
  for (const group of progress.groups) {
    const split = creditSplit(group, snapshot);
    total.completed += split.completed;
    total.inProgress += split.inProgress;
    total.planned += split.planned;
  }
  return total;
}

/** What a complementary group lacks: credits first, then the first rule it fails. Null when only rules to check are left. */
export function lacking(group: GroupProgress): string | null {
  if (group.creditsDone < group.credits) {
    return `${creditsText(group.credits - group.creditsDone)} to go`;
  }
  const open = group.rules.filter((rule) => !rule.satisfied && !rule.unparsed);
  const [rule] = open;
  if (!rule) {
    return group.minCourses !== undefined &&
      group.coursesDone < group.minCourses
      ? `${group.coursesDone} of ${group.minCourses} courses`
      : null;
  }
  const need =
    rule.minCredits === undefined
      ? `${rule.coursesDone} of ${rule.minCourses} courses`
      : `${creditsText(rule.minCredits - rule.creditsDone)} to go`;
  return `${rule.title} (${need})${open.length > 1 ? ` and ${open.length - 1} more` : ""}`;
}
