import { creditsText, sentence } from "../format.ts";
import type { EntryRoute } from "../profile/types.ts";
import { isMinor } from "../programs/minor.ts";
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
  /** Courses this program may not count, such as a minor's share of the program's courses past its overlap cap. */
  exclude?: ReadonlySet<string>;
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
  /** The crawler could not read this rule, so nothing counts toward it and it is met only once the student marks it as checked. */
  unparsed?: true;
  /** An unparsed rule the student marked as checked, so it counts as met. */
  confirmed?: true;
  /** The courses the student listed under the rule, in the order added, with their credits. The ones the basis counts are claimed first, up to the group's credits. */
  listed?: Claimed[];
  /** The student's adviser must approve the courses, so the page shows a reminder. */
  adviser?: true;
  /** The counted courses must span this many subjects. */
  minSubjects?: number;
  /** The option the rule belongs to, in a group that counts one option. */
  option?: string;
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
  /** Rules in the group that still need a manual check. Such a group is never satisfied. */
  unparsed: number;
  /** Every unparsed rule is checked and the others only remind, so the group counts as met with full credits, like a credited one. */
  confirmed?: true;
  /** Complementary groups: the top of the group's range, up to which its courses count toward the program total. */
  maxCredits?: number;
  /** Only on the replace group: the required courses met without credit, with the catalogue credits it makes up for. */
  replaces?: Claimed[];
  /** In a group that counts one option, the option furthest along, which stands for the group. */
  option?: string;
}

export interface ProgramProgress {
  credits: number;
  /** Credits across groups, each group capped at what it needs, or at the top of its range. */
  creditsDone: number;
  /** Every group is met and, for a program with a credit total, the credits reach it. */
  satisfied: boolean;
  /** In the same order as the program file. */
  groups: GroupProgress[];
  /** Every required item still missing, across required groups. */
  remaining: RequiredItem[];
  /** Counted courses that no group claimed. They still count toward the degree's total credits. */
  unclaimed: Claimed[];
}

/** Title of the group that makes up the credits of required courses met without credit. */
export const REPLACE_TITLE = "Replace exempted credits";

/** The replace group's one rule, open to any course. */
const ANY_COURSE: Rule = { title: "Any course", match: {} };

function matchesMatch(match: Match, code: string): boolean {
  const space = code.indexOf(" ");
  const subject = code.slice(0, space);
  if (
    (match.subjects && !match.subjects.includes(subject)) ||
    match.excludeSubjects?.includes(subject)
  ) {
    return false;
  }
  const level = Math.floor(Number(code.slice(space + 1)) / 100) * 100;
  return (
    (match.minLevel === undefined || level >= match.minLevel) &&
    (match.maxLevel === undefined || level <= match.maxLevel) &&
    !match.exclude?.includes(code)
  );
}

/** "Other Education courses may be included with the permission of the Program Adviser": an adviser rule with no amount, which reminds and counts no course. */
export const isReminder = (rule: Rule) =>
  rule.adviser === true &&
  rule.minCredits === undefined &&
  rule.maxCredits === undefined;

export function ruleMatches(rule: Rule, code: string): boolean {
  if (rule.unparsed || isReminder(rule)) return false;
  return Boolean(
    rule.courses?.includes(code) ||
      (rule.match && matchesMatch(rule.match, code)),
  );
}

/** A rule that only filters, such as "at least 6 credits at the 400 level", "at most 6 credits of SEAD courses" or a spread over the group, and names no courses of its own. A cap with no minimum, as "A or B, but not both", only narrows the lists, so a course it names and no list does stays out. */
const isFilter = (rule: Rule) =>
  (rule.maxCourses !== undefined &&
    rule.minCredits === undefined &&
    rule.minCourses === undefined) ||
  (!rule.courses &&
    (rule.filter === true ||
      !rule.match?.subjects ||
      rule.maxCreditsPerSubject !== undefined ||
      rule.minSubjects !== undefined));

const subjectOf = (code: string) => code.slice(0, code.indexOf(" "));

/** How many subjects some courses span. */
const subjectsIn = (courses: readonly Claimed[]) =>
  new Set(courses.map((c) => subjectOf(c.code))).size;

/** A rule open to any course, maybe but some subjects, such as "42 credits of Free Electives". An adviser's or a spread rule's empty match keeps its own meaning. */
const isOpen = (rule: Rule) =>
  !rule.courses &&
  rule.match !== undefined &&
  !rule.match.subjects &&
  rule.match.minLevel === undefined &&
  rule.match.maxLevel === undefined &&
  !rule.adviser &&
  rule.maxCreditsPerSubject === undefined &&
  rule.minSubjects === undefined;

/** True when the student completes one of the group's options, so only that option's rules need to be met. */
export const picksOne = (group: ComplementaryGroup) =>
  group.rules.some((rule) => rule.option);

/** True when the group lists courses or subjects, false for "any department" groups like a free elective. */
export function namesCourses(group: ComplementaryGroup): boolean {
  return (
    !group.rules.some(isOpen) && group.rules.some((rule) => !isFilter(rule))
  );
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

/** The union of the rules that name courses. A group of only filters, or with a rule open to any course, allows whatever its rules match. */
export function groupAllows(group: ComplementaryGroup, code: string): boolean {
  const rules = namesCourses(group)
    ? group.rules.filter((rule) => !isFilter(rule))
    : group.rules;
  return rules.some((rule) => ruleMatches(rule, code));
}

/** "9 credits chosen in consultation with an adviser" next to course lists: it adds any course it matches to the group, up to its credits. */
const addsApproved = (group: ComplementaryGroup, rule: Rule) =>
  rule.adviser === true &&
  isFilter(rule) &&
  rule.maxCredits !== undefined &&
  namesCourses(group);

/** What the group counts: what its lists allow, plus the courses an adviser approves on top of them. */
const counts = (group: ComplementaryGroup, code: string) =>
  groupAllows(group, code) ||
  group.rules.some(
    (rule) => addsApproved(group, rule) && ruleMatches(rule, code),
  );

/** True when one more course stays within the caps of every rule it matches, given what each rule already holds, in rule order. */
export function fitsCaps(
  group: ComplementaryGroup,
  held: readonly Pick<RuleProgress, "courses">[],
  code: string,
  credits: number,
): boolean {
  return group.rules.every((rule, i) => {
    if (!ruleMatches(rule, code)) return true;
    // An adviser's extra caps only the courses it adds, never those the lists name.
    const extra = addsApproved(group, rule);
    if (extra && groupAllows(group, code)) return true;
    const mine = (held[i]?.courses ?? []).filter(
      (c) => !extra || !groupAllows(group, c.code),
    );
    const creditsDone = mine.reduce((sum, c) => sum + c.credits, 0);
    const sameSubject = mine
      .filter((c) => subjectOf(c.code) === subjectOf(code))
      .reduce((sum, c) => sum + c.credits, 0);
    // "9 credits from" is a target, not a cap: a 4-credit course may overshoot it, and reaching it must not refuse courses from other rules the course also fits. A range narrower than the course, as "3-4 credits of", only records that courses differ in credits.
    const cap =
      !extra &&
      rule.minCredits !== undefined &&
      rule.maxCredits !== undefined &&
      rule.maxCredits - rule.minCredits < credits
        ? undefined
        : rule.maxCredits;
    return (
      (cap === undefined || creditsDone + credits <= cap) &&
      (rule.maxCourses === undefined || mine.length < rule.maxCourses) &&
      (rule.maxCreditsPerSubject === undefined ||
        sameSubject + credits <= rule.maxCreditsPerSubject)
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

/** An exemption, a waiver or a Science DEC equivalent meets its item without credit, so its catalogue credits move to `replaces`. */
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

/** The key a rule the student marked as checked, or listed courses under, is saved under. The same text recurs in two streams of one group and in groups that share a title, so it holds the option and how many groups of that title come before. */
export function checkKey(
  program: Program,
  group: ComplementaryGroup,
  rule: Rule,
): string {
  const before = program.groups
    .slice(0, Math.max(0, program.groups.indexOf(group)))
    .filter((g) => g.title === group.title).length;
  return [program.id, group.title, before, rule.option ?? "", rule.title].join(
    "\u0000",
  );
}

const replaceGroup = (credits: number): ComplementaryGroup => ({
  title: REPLACE_TITLE,
  kind: "complementary",
  credits,
  rules: [ANY_COURSE],
});

/** The key the courses the student picks for the replace group are saved under. */
export const replaceKey = (program: Program) =>
  checkKey(program, replaceGroup(0), ANY_COURSE);

/** What the student marked on a program's rules. */
interface Marks {
  /** The unparsed rules the student marked as checked. */
  confirmed: (rule: Rule) => boolean;
  /** The courses the student listed under a rule. */
  listed: (rule: Rule) => Claimed[];
  /** Every course listed under a rule of the program, which no group counts unless its rule lists it. */
  reserved: ReadonlySet<string>;
}

const NO_MARKS: Marks = {
  confirmed: () => false,
  listed: () => [],
  reserved: new Set(),
};

/** `streams` is false inside one option's count, which keeps each rule's option for its key. The group stops taking courses once it holds `limit` credits. */
function complementaryProgress(
  group: ComplementaryGroup,
  counted: ReadonlyMap<string, number>,
  used: Set<string>,
  marks: Marks = NO_MARKS,
  streams = true,
  limit = group.credits,
): GroupProgress {
  const names = streams
    ? [...new Set(group.rules.flatMap((rule) => rule.option ?? []))]
    : [];
  if (names.length > 0) {
    // Each option is counted with the shared rules as if it were the whole group, and the one furthest along stands for the group.
    const options = names.map((name) => {
      const mine = group.rules.flatMap((rule, i) =>
        rule.option === undefined || rule.option === name ? [{ rule, i }] : [],
      );
      const progress = complementaryProgress(
        { ...group, rules: mine.map(({ rule }) => rule) },
        counted,
        new Set(used),
        marks,
        false,
        limit,
      );
      return { name, mine, progress };
    });
    const best = options.reduce((a, b) =>
      b.progress.satisfied > a.progress.satisfied ||
      (b.progress.satisfied === a.progress.satisfied &&
        b.progress.creditsDone > a.progress.creditsDone)
        ? b
        : a,
    );
    for (const { code } of best.progress.courses) used.add(code);
    // In file order: an option's own rules as its count read them, the shared rules as the best option's did.
    const rules = group.rules.flatMap((rule, i) => {
      const own = rule.option;
      const from = options.find((o) => o.name === own) ?? best;
      const done = from.progress.rules[from.mine.findIndex((m) => m.i === i)];
      return done
        ? [{ ...done, ...(own !== undefined && { option: own }) }]
        : [];
    });
    return { ...best.progress, option: best.name, rules };
  }
  const pool = new Map<string, number>();
  for (const [code, credits] of counted) {
    if (!used.has(code) && !marks.reserved.has(code) && counts(group, code)) {
      pool.set(code, credits);
    }
  }
  const state = group.rules.map((rule) => ({
    rule,
    listed: marks.listed(rule),
    creditsDone: 0,
    coursesDone: 0,
    courses: [] as Claimed[],
  }));
  const chosen = new Map<string, number>();
  let total = 0;
  const full = () => total >= limit && chosen.size >= (group.minCourses ?? 0);

  const fits = (code: string, credits: number) =>
    fitsCaps(group, state, code, credits);
  const take = (code: string, credits: number) => {
    chosen.set(code, credits);
    total += credits;
    for (const s of state) {
      if (
        ruleMatches(s.rule, code) ||
        s.listed.some((listed) => listed.code === code)
      ) {
        s.creditsDone += credits;
        s.coursesDone++;
        s.courses.push({ code, credits });
      }
    }
  };

  // Courses the student listed count first, up to the group's credits and the rule's cap.
  for (const s of state) {
    for (const { code } of s.listed) {
      const credits = counted.get(code);
      if (full()) break;
      if (
        credits !== undefined &&
        !used.has(code) &&
        !chosen.has(code) &&
        (s.rule.maxCredits === undefined ||
          s.creditsDone + credits <= s.rule.maxCredits)
      ) {
        take(code, credits);
      }
    }
  }

  // ponytail: greedy per group in file order with no backtracking, so a course two groups could use goes to the first. Upgrade to matching if real transcripts hit it.
  for (const s of state) {
    for (const [code, credits] of pool) {
      const short =
        s.creditsDone < (s.rule.minCredits ?? 0) ||
        s.coursesDone < (s.rule.minCourses ?? 0);
      const narrow = subjectsIn(s.courses) < (s.rule.minSubjects ?? 0);
      if (!short && !narrow) break;
      // Once the credits are there, only a course of a new subject helps.
      const known = s.courses.some(
        (c) => subjectOf(c.code) === subjectOf(code),
      );
      if (!short && known) continue;
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
    if (full()) break;
    if (!chosen.has(code) && fits(code, credits)) take(code, credits);
  }

  for (const code of chosen.keys()) used.add(code);
  const rules = state.map(
    ({ rule, listed, creditsDone, coursesDone, courses }) => {
      const checked = rule.unparsed === true && marks.confirmed(rule);
      return {
        title: rule.title,
        creditsDone,
        coursesDone,
        courses,
        minCredits: rule.minCredits,
        minCourses: rule.minCourses,
        unparsed: rule.unparsed,
        ...(checked && { confirmed: true as const }),
        ...(listed.length > 0 && { listed }),
        adviser: rule.adviser,
        minSubjects: rule.minSubjects,
        satisfied: rule.unparsed
          ? checked
          : creditsDone >= (rule.minCredits ?? 0) &&
            coursesDone >= (rule.minCourses ?? 0) &&
            subjectsIn(courses) >= (rule.minSubjects ?? 0),
      };
    },
  );
  // Nothing can count toward a group of only unparsed rules and reminders, so once every unparsed one is checked it is met in full.
  const checked =
    rules.some((rule) => rule.confirmed) &&
    group.rules.every((rule, i) => rules[i]?.confirmed || isReminder(rule));
  return {
    title: group.title,
    kind: "complementary",
    credits: group.credits,
    ...(group.maxCredits !== undefined && { maxCredits: group.maxCredits }),
    creditsDone: checked ? group.credits : total,
    minCourses: group.minCourses,
    coursesDone: chosen.size,
    satisfied:
      checked ||
      (total >= group.credits &&
        chosen.size >= (group.minCourses ?? 0) &&
        rules.every((rule) => rule.satisfied)),
    credited: false,
    courses: [...chosen].map(([code, credits]) => ({ code, credits })),
    remaining: [],
    rules,
    unparsed: rules.filter((rule) => rule.unparsed && !rule.confirmed).length,
    ...(checked && { confirmed: true as const }),
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
  // An exemption or a waiver satisfies a required course but is never in `counted`, so it adds no credit.
  const allowed = (code: string) => !count.exclude?.has(code);
  const have = new Set([...snapshot.done].filter(allowed));
  const counted = new Map<string, number>();
  for (const [code, credits] of snapshot.earned) {
    if (allowed(code)) counted.set(code, credits ?? creditsOf(code));
  }
  const extra: Iterable<string>[] = [];
  if (count.inProgress) extra.push(snapshot.inProgress.keys());
  if (count.planned) extra.push(snapshot.planned);
  for (const codes of extra) {
    for (const code of codes) {
      if (!allowed(code)) continue;
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
  const listedUnder = (key: string) => snapshot.assigned.get(key) ?? [];
  const open = program.groups.filter(
    (group): group is ComplementaryGroup =>
      !credited(group) && group.kind === "complementary",
  );
  // A listed course waits for its rule, so a group before it never takes it.
  const reserved = new Set([
    ...open.flatMap((group) =>
      group.rules.flatMap((rule) =>
        listedUnder(checkKey(program, group, rule)),
      ),
    ),
    ...listedUnder(replaceKey(program)),
  ]);
  const marks = (group: ComplementaryGroup): Marks => ({
    confirmed: (rule) => snapshot.checked.has(checkKey(program, group, rule)),
    listed: (rule) =>
      listedUnder(checkKey(program, group, rule)).map((code) => ({
        code,
        credits: counted.get(code) ?? creditsOf(code),
      })),
    reserved,
  });
  for (const group of open) {
    results.set(
      group,
      complementaryProgress(group, counted, used, marks(group)),
    );
  }
  const groups = program.groups.flatMap((group) => results.get(group) ?? []);
  const moved = replaces.reduce((sum, claimed) => sum + claimed.credits, 0);
  if (moved > 0) {
    // Last, so it takes only what no group of the program wanted. It stays after the program's groups, so their indexes still line up.
    const replace = replaceGroup(moved);
    groups.push({
      ...complementaryProgress(replace, counted, used, marks(replace)),
      replaces,
    });
  }
  // Once every group has what it needs, a range takes the courses nobody else did, up to its top. It picks the same courses first, so it stays met.
  program.groups.forEach((group, i) => {
    const done = groups[i];
    if (
      group.kind !== "complementary" ||
      group.maxCredits === undefined ||
      !done ||
      done.credited ||
      done.confirmed
    ) {
      return;
    }
    for (const { code } of done.courses) used.delete(code);
    groups[i] = complementaryProgress(
      group,
      counted,
      used,
      marks(group),
      true,
      group.maxCredits,
    );
  });
  const creditsDone = groups.reduce(
    (sum, group) =>
      sum + Math.min(group.creditsDone, group.maxCredits ?? group.credits),
    0,
  );
  return {
    credits: program.credits,
    creditsDone,
    satisfied:
      groups.every((group) => group.satisfied) &&
      creditsDone >= program.credits,
    groups,
    remaining: groups.flatMap((group) => group.remaining),
    unclaimed: [...counted]
      .filter(([code]) => !used.has(code))
      .map(([code, credits]) => ({ code, credits })),
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
  exclude?: ReadonlySet<string>,
): ProgramProgress {
  return programProgress(program, snapshot, catalogue, {
    ...BASIS[basis],
    entry,
    exclude,
  });
}

export function countedInstead(
  program: Program,
  progress: ProgramProgress,
  code: string,
): { options: string[]; instead: string } | null {
  if (!progress.unclaimed.some((claimed) => claimed.code === code)) return null;
  const claimed = new Set(
    progress.groups.flatMap((group) => group.courses.map((c) => c.code)),
  );
  for (const group of program.groups) {
    if (group.kind !== "required") continue;
    for (const item of group.courses) {
      if (typeof item === "string" || !item.oneOf.includes(code)) continue;
      const instead = item.oneOf.find((c) => claimed.has(c));
      if (instead) return { options: [...new Set(item.oneOf)], instead };
    }
  }
  return null;
}

/** An Arts degree, where no course may fulfill more than one program (mcgill.ca/oasis degree planning guide). A B.A. counts even when a Science department runs the component. */
const inArts = (program: Program) =>
  program.faculty === "Arts" || program.degree === "B.A.";

/**
 * The most credits a second program may share with the program: what its page says, else 0 in Arts. Undefined when nobody says, so every shared course counts for both.
 * A minor reads only its own page and faculty. Any other second program also reads the program's, since a joint honours or a double major is one degree.
 */
export const overlapCap = (
  second: Program,
  program: Program | null = null,
): number | undefined =>
  isMinor(second)
    ? (second.overlap ?? (second.faculty === "Arts" ? 0 : undefined))
    : (second.overlap ??
      program?.overlap ??
      ([second, program].some((p) => p && inArts(p)) ? 0 : undefined));

/** How a minor or other second program shares the program's courses: `shared` counts for both, `programOnly` went past the cap and counts for the program alone. */
export interface MinorOverlap {
  cap: number | undefined;
  shared: ReadonlySet<string>;
  programOnly: ReadonlySet<string>;
  /** Credits still free to share, Infinity without a cap. */
  left: number;
}

/** A program counted before a second program, with the courses it may not count past its own cap. */
interface Earlier {
  program: Program;
  exclude?: ReadonlySet<string>;
}

/**
 * Lets the minor count the courses the program and any `earlier` second program count, up to its cap, in the minor's group order, and leaves the rest to them.
 * The cap is one budget across all of them, since no page says a minor may share its cap again with each program.
 */
export function minorOverlap(
  minor: Program,
  program: Program | null,
  snapshot: Snapshot,
  catalogue: Catalogue,
  entry: EntryRoute | null,
  basis: Basis,
  earlier: readonly Earlier[] = [],
): MinorOverlap {
  const cap = overlapCap(minor, program);
  const programCodes = new Set(
    [...(program ? [{ program }] : []), ...earlier].flatMap((other) =>
      programStanding(
        other.program,
        snapshot,
        catalogue,
        entry,
        basis,
        other.exclude,
      )
        .groups.flatMap((group) => group.courses)
        .map((course) => course.code),
    ),
  );
  const programOnly = new Set<string>();
  // ponytail: greedy passes keep the minor's earliest shared courses, a search could pick the ones that help it most.
  for (;;) {
    const claimed = programStanding(
      minor,
      snapshot,
      catalogue,
      entry,
      basis,
      programOnly,
    ).groups.flatMap((group) => group.courses);
    const shared = new Set<string>();
    let left = cap ?? Number.POSITIVE_INFINITY;
    let over = false;
    for (const { code, credits } of claimed) {
      if (!programCodes.has(code)) continue;
      if (credits <= left) {
        left -= credits;
        shared.add(code);
      } else {
        programOnly.add(code);
        over = true;
      }
    }
    if (!over) return { cap, shared, programOnly, left };
  }
}

/** Credits by the status of the courses that earned them, for a `StatusBar`. */
export interface CreditSplit {
  completed: number;
  inProgress: number;
  planned: number;
}

/** A group's credits by the status of the courses it claimed, capped at what it needs or at `top`: earned first, then in progress, then planned. Pass a group counted with the plan. */
export function creditSplit(
  group: Pick<GroupProgress, "credited" | "confirmed" | "credits" | "courses">,
  snapshot: Snapshot,
  top = group.credits,
): CreditSplit {
  if (group.credited || group.confirmed) {
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
  let left = top;
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

/** The courses behind each part of a split, for the legend's tooltips: a CEGEP-credited or checked group by its title. */
export function splitCourses(
  groups: readonly Pick<
    GroupProgress,
    "credited" | "confirmed" | "credits" | "title" | "courses"
  >[],
  snapshot: Snapshot,
): Record<keyof CreditSplit, string[]> {
  const parts = {
    completed: new Set<string>(),
    inProgress: new Set<string>(),
    planned: new Set<string>(),
  };
  for (const group of groups) {
    if (group.credited || group.confirmed) {
      if (group.credits > 0) {
        parts.completed.add(
          `${sentence(group.title)} (${group.credited ? "CEGEP" : "checked by you"})`,
        );
      }
      continue;
    }
    for (const { code } of group.courses) {
      if (snapshot.inProgress.has(code)) parts.inProgress.add(code);
      else if (snapshot.planned.has(code)) parts.planned.add(code);
      else parts.completed.add(code);
    }
  }
  return {
    completed: [...parts.completed].sort(),
    inProgress: [...parts.inProgress].sort(),
    planned: [...parts.planned].sort(),
  };
}

/** A program's credits by status, the sum of its groups' splits, each range counted up to its top. */
export function programSplit(
  progress: ProgramProgress,
  snapshot: Snapshot,
): CreditSplit {
  const total = { completed: 0, inProgress: 0, planned: 0 };
  for (const group of progress.groups) {
    const split = creditSplit(
      group,
      snapshot,
      group.maxCredits ?? group.credits,
    );
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
  const open = group.rules.filter(
    (rule) =>
      !rule.satisfied &&
      !rule.unparsed &&
      (rule.option === undefined || rule.option === group.option),
  );
  const [rule] = open;
  if (!rule) {
    return group.minCourses !== undefined &&
      group.coursesDone < group.minCourses
      ? `${group.coursesDone} of ${group.minCourses} courses`
      : null;
  }
  const need =
    rule.minCredits !== undefined && rule.creditsDone < rule.minCredits
      ? `${creditsText(rule.minCredits - rule.creditsDone)} to go`
      : rule.minCourses !== undefined && rule.coursesDone < rule.minCourses
        ? `${rule.coursesDone} of ${rule.minCourses} courses`
        : `${subjectsIn(rule.courses)} of ${rule.minSubjects} subjects`;
  return `${rule.title} (${need})${open.length > 1 ? ` and ${open.length - 1} more` : ""}`;
}

/** The overlap of each second program in turn, the second program first and then the extra minor, each sharing with the program and the ones before it. */
export function secondOverlaps(
  seconds: readonly Program[],
  program: Program | null,
  snapshot: Snapshot,
  catalogue: Catalogue,
  entry: EntryRoute | null,
  basis: Basis,
): MinorOverlap[] {
  const result: MinorOverlap[] = [];
  for (const second of seconds) {
    result.push(
      minorOverlap(
        second,
        program,
        snapshot,
        catalogue,
        entry,
        basis,
        seconds.slice(0, result.length).map((earlier, i) => ({
          program: earlier,
          exclude: result[i]?.programOnly,
        })),
      ),
    );
  }
  return result;
}
