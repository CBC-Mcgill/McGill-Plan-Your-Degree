import { expect, test } from "vitest";
import type { Course, Requirement } from "../catalogue/types.ts";
import type { CourseRecord, Plan, Term } from "../profile/types.ts";
import type { ComplementaryGroup, Program, Rule } from "../programs/types.ts";
import { validateProgram } from "../programs/validate.ts";
import { earnedCredits, pendingCredits } from "./credits.ts";
import { whatsNext } from "./next.ts";
import { nextView } from "./next-view.ts";
import { planLoads, planWarnings, schoolTerms, termChoices } from "./plan.ts";
import {
  checkKey,
  creditSources,
  creditSplit,
  fitsCaps,
  type GroupProgress,
  namesCourses,
  programProgress,
  programSplit,
  REPLACE_TITLE,
  replaceKey,
  ruleMatches,
  splitCourses,
} from "./progress.ts";
import { buildSnapshot } from "./snapshot.ts";
import { fillForTerm } from "./stages.ts";
import { courseStatus } from "./status.ts";

const req = (tree: Requirement["tree"], unparsed = false): Requirement => ({
  text: "",
  tree,
  unparsed,
});

const course = (code: string, extra: Partial<Course> = {}): Course => ({
  code,
  subject: code.slice(0, 4),
  number: code.slice(5),
  title: code,
  credits: 3,
  offeredBy: null,
  faculty: null,
  terms: ["Fall 2026", "Winter 2027"],
  description: "",
  prerequisites: null,
  corequisites: null,
  restrictions: null,
  notes: [],
  ...extra,
});

const catalogue = new Map(
  [
    course("COMP 202", { terms: ["Summer 2026", "Fall 2026", "Winter 2027"] }),
    course("COMP 250"),
    course("MATH 240"),
    course("COMP 251", {
      prerequisites: req({ and: ["COMP 250", "MATH 240"] }),
    }),
    course("COMP 302", {
      prerequisites: req({ and: ["COMP 250", "COMP 251"] }),
    }),
    course("COMP 330", { terms: ["Fall 2026"] }),
    course("COMP 350", { terms: ["Fall 2026"] }),
    course("COMP 424", {
      terms: ["Winter 2027"],
      prerequisites: req({ or: ["COMP 251", "COMP 202"] }, true),
      corequisites: req("COMP 360"),
      restrictions: { text: "", excludes: ["ECSE 526"] },
    }),
    course("ECSE 526", { restrictions: { text: "", excludes: ["COMP 424"] } }),
    course("ECSE 458", {
      credits: 6,
      terms: ["Fall 2026", "Winter 2027"],
      parts: [
        { code: "ECSE 458D1", credits: 3, terms: ["Fall 2026"] },
        { code: "ECSE 458D2", credits: 3, terms: ["Winter 2027"] },
      ],
    }),
  ].map((c) => [c.code, c]),
);

const fall2026: Term = { season: "Fall", year: 2026 };
const record = (
  code: string,
  status: CourseRecord["status"],
  credits: number | null = 3,
): CourseRecord => ({
  code,
  term: fall2026,
  credits,
  grade: null,
  status,
  source: "manual",
});

// COMP 250 and COMP 330 done, MATH 240 exempt, COMP 202 running.
const records = [
  record("COMP 250", "completed"),
  record("COMP 330", "completed"),
  record("MATH 240", "exemption", null),
  record("COMP 202", "in-progress"),
];
const snapshot = buildSnapshot(records);

const tiny: Program = {
  id: "tiny-major-bsc",
  name: "Tiny Major",
  degree: "B.Sc.",
  faculty: "Science",
  catalogueYear: "2026-2027",
  source: "https://coursecatalogue.mcgill.ca/en/undergraduate/science/",
  credits: 15,
  groups: [
    {
      title: "Required Courses",
      kind: "required",
      credits: 9,
      courses: ["COMP 250", "COMP 251", "MATH 240"],
    },
    {
      title: "Complementary Courses",
      kind: "complementary",
      credits: 6,
      rules: [
        {
          title: "3 credits from theory",
          minCredits: 3,
          courses: ["COMP 330", "COMP 360"],
        },
        {
          title: "Remaining credits from COMP 300 and up",
          match: { subjects: ["COMP"], minLevel: 300, exclude: ["COMP 396"] },
        },
      ],
    },
  ],
};

test("status follows done, in-progress, prerequisites, and restrictions", () => {
  const status = (code: string, snap = snapshot) =>
    courseStatus(catalogue.get(code) as Course, snap);
  expect(status("COMP 250").status).toBe("completed");
  expect(status("COMP 202").status).toBe("in-progress");
  expect(status("COMP 251").status).toBe("available");
  expect(status("COMP 302").status).toBe("locked");
  // COMP 202 in progress meets the "or equivalent" tree, but the text has more conditions.
  expect(status("COMP 424")).toMatchObject({
    status: "available",
    uncertain: true,
  });
  const running = buildSnapshot([
    ...records,
    record("COMP 424", "in-progress"),
  ]);
  expect(status("ECSE 526", running)).toMatchObject({
    status: "locked",
    blockedBy: ["COMP 424"],
  });
});

test("what's next splits by program and matches the term's season", () => {
  expect(validateProgram(tiny).ok).toBe(true);
  const next = whatsNext(
    catalogue,
    snapshot,
    { season: "Winter", year: 2027 },
    tiny,
  );
  const codes = (list: typeof next.mustTake) => list.map((s) => s.course.code);
  expect(codes(next.mustTake)).toEqual(["COMP 251"]);
  expect(codes(next.canTake.complementary)).toEqual(["COMP 424"]);
  // ECSE 458 starts in Fall, COMP 302 is locked, COMP 350 runs in Fall only.
  expect(codes(next.canTake.other)).toEqual(["ECSE 526"]);
});

test("what's next shows a whole course list, with why a course is not open", () => {
  const pick: Program = {
    ...tiny,
    groups: [
      {
        title: "Pick one",
        kind: "complementary",
        credits: 3,
        rules: [
          {
            title: "Pick one",
            minCredits: 3,
            courses: ["COMP 350", "COMP 424"],
          },
        ],
      },
    ],
  };
  const winter = { season: "Winter", year: 2027 } as const;
  const [group] = nextView(catalogue, snapshot, winter, pick).complementary;
  expect(
    group?.buckets[0]?.entries.map(({ course, reason }) => [
      course.code,
      reason,
    ]),
  ).toEqual([
    ["COMP 424", undefined],
    ["COMP 350", "Not offered in Winter"],
  ]);
});

test("a term fills with required courses first, then what open complementary groups take", () => {
  const winter = { season: "Winter", year: 2027 } as const;
  const fill = (plan: Plan) =>
    fillForTerm(
      tiny,
      buildSnapshot(records, plan),
      catalogue,
      plan,
      winter,
    ).map(({ course, group, kind }) => [course.code, group, kind]);
  expect(fill([])).toEqual([
    ["COMP 251", 0, "required"],
    ["COMP 424", 1, "complementary"],
  ]);
  // Planned in an earlier term, COMP 251 leaves the list and opens COMP 302.
  expect(fill([{ term: fall2026, courses: ["COMP 251"] }])).toEqual([
    ["COMP 302", 1, "complementary"],
    ["COMP 424", 1, "complementary"],
  ]);
});

test("an exemption meets its course, and its credits move to a group any course fills", () => {
  const progress = programProgress(tiny, snapshot, catalogue);
  expect(progress.satisfied).toBe(false);
  expect(progress.remaining).toEqual(["COMP 251"]);
  expect(
    progress.groups.map((g) => [g.title, g.creditsDone, g.credits]),
  ).toEqual([
    ["Required Courses", 3, 6],
    ["Complementary Courses", 3, 6],
    [REPLACE_TITLE, 0, 3],
  ]);
  expect(progress.groups[2]?.replaces).toEqual([
    { code: "MATH 240", credits: 3 },
  ]);
  const withPlan = (courses: string[]) =>
    programProgress(
      tiny,
      buildSnapshot(records, [
        { term: { season: "Winter", year: 2027 }, courses },
      ]),
      catalogue,
      { planned: true },
    );
  // Every catalogue group is met, but MATH 240's 3 credits are still to make up.
  expect(withPlan(["COMP 251", "COMP 424"]).satisfied).toBe(false);
  const met = withPlan(["COMP 251", "COMP 424", "COMP 302"]);
  expect([met.satisfied, met.creditsDone, met.credits]).toEqual([true, 15, 15]);
});

test("credit splits count earned, then in progress, then planned, up to what a group needs", () => {
  const planned = buildSnapshot(records, [
    {
      term: { season: "Winter", year: 2027 },
      courses: ["COMP 251", "COMP 424", "COMP 302"],
    },
  ]);
  const progress = programProgress(tiny, planned, catalogue, {
    inProgress: true,
    planned: true,
  });
  const [required, complementary] = progress.groups;
  // COMP 250 earned, COMP 251 planned, MATH 240 exempt with no credit.
  expect(required && creditSplit(required, planned)).toEqual({
    completed: 3,
    inProgress: 0,
    planned: 3,
  });
  // COMP 330 earned, then COMP 424 fills the last 3 credits and COMP 302 has no room.
  expect(complementary && creditSplit(complementary, planned)).toEqual({
    completed: 3,
    inProgress: 0,
    planned: 3,
  });
  // COMP 202 in progress makes up the exempt MATH 240's credits.
  expect(programSplit(progress, planned)).toEqual({
    completed: 6,
    inProgress: 3,
    planned: 6,
  });
});

test("program progress lists the courses each group and rule claimed, and the replace group takes what nobody did", () => {
  const [required] = tiny.groups;
  const program: Program = {
    ...tiny,
    groups: [
      ...(required ? [required] : []),
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          { title: "Theory", courses: ["COMP 250", "COMP 330"] },
          {
            title: "COMP 300 and up",
            match: { subjects: ["COMP"], minLevel: 300 },
          },
        ],
      },
    ],
  };
  const progress = programProgress(program, snapshot, catalogue, {
    inProgress: true,
  });
  const [first, second] = progress.groups;
  expect(first?.courses).toEqual([
    { code: "COMP 250", credits: 3 },
    { code: "MATH 240", credits: 0 },
  ]);
  expect(second?.courses).toEqual([{ code: "COMP 330", credits: 3 }]);
  expect(second?.rules.map((rule) => rule.courses)).toEqual([
    [{ code: "COMP 330", credits: 3 }],
    [{ code: "COMP 330", credits: 3 }],
  ]);
  expect(progress.groups[2]?.courses).toEqual([
    { code: "COMP 202", credits: 3 },
  ]);
  expect(progress.unclaimed).toEqual([]);
});

test("an unparsed rule matches no course and caps nothing", () => {
  const rule = {
    title: "9 credits from Groups A and B",
    unparsed: true as const,
  };
  expect(ruleMatches(rule, "COMP 202")).toBe(false);
  expect(ruleMatches({ ...rule, courses: ["COMP 202"] }, "COMP 202")).toBe(
    false,
  );
  const group = {
    title: "Complementary",
    kind: "complementary" as const,
    credits: 9,
    rules: [{ ...rule, maxCredits: 3 }],
  };
  expect(
    fitsCaps(
      group,
      [{ courses: [{ code: "COMP 250", credits: 3 }] }],
      "COMP 202",
      3,
    ),
  ).toBe(true);
});

test("a group with an unparsed rule is never satisfied and counts the rules to check", () => {
  const check = {
    title: "No more than 9 credits per discipline",
    unparsed: true as const,
  };
  const checked: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 3,
        rules: [{ title: "Theory", courses: ["COMP 330"] }, check],
      },
    ],
  };
  const [group] = programProgress(checked, snapshot, catalogue).groups;
  expect(group).toMatchObject({
    creditsDone: 3,
    unparsed: 1,
    satisfied: false,
  });
  expect(group?.rules.map((rule) => rule.satisfied)).toEqual([true, false]);
  expect(programProgress(checked, snapshot, catalogue).satisfied).toBe(false);
});

test("a rule the student marked as checked is met, and a group of only such rules is met in full", () => {
  const check = (title: string, option?: string): Rule => ({
    title,
    unparsed: true,
    ...(option && { option }),
  });
  const confirming: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          { title: "Theory", courses: ["COMP 330", "COMP 360"] },
          check("No more than 3 credits per discipline"),
        ],
      },
      {
        title: "Program Requirements",
        kind: "complementary",
        credits: 0,
        rules: [check("At most 31 credits at the 200 level")],
      },
      {
        title: "Program Requirements",
        kind: "complementary",
        credits: 9,
        rules: [check("At most 31 credits at the 200 level")],
      },
      {
        title: "Streams",
        kind: "complementary",
        credits: 6,
        rules: [
          { title: "Theory", option: "A", courses: ["COMP 360"] },
          check("6 credits from the stream list", "B"),
        ],
      },
    ],
  };
  const key = (g: number, r: number) => {
    const group = confirming.groups[g] as ComplementaryGroup;
    return checkKey(confirming, group, group.rules[r] as Rule);
  };
  const marked = buildSnapshot([record("COMP 330", "completed")], [], null, [
    key(0, 1),
    key(1, 0),
    key(3, 1),
  ]);
  const progress = programProgress(confirming, marked, catalogue);
  const [a, b, c, d] = progress.groups;
  expect(a).toMatchObject({ creditsDone: 3, satisfied: false, unparsed: 0 });
  expect(a?.confirmed).toBeUndefined();
  expect(a?.rules[1]).toMatchObject({ confirmed: true, satisfied: true });
  expect(b).toMatchObject({ creditsDone: 0, satisfied: true, confirmed: true });
  // Same title and text as the group before it, but its own key.
  expect(c).toMatchObject({ creditsDone: 0, satisfied: false, unparsed: 1 });
  expect(d).toMatchObject({
    creditsDone: 6,
    satisfied: true,
    confirmed: true,
    option: "B",
  });
  expect(programSplit(progress, marked).completed).toBe(9);
  expect(splitCourses(progress.groups, marked).completed).toEqual([
    "COMP 330",
    "Streams (checked by you)",
  ]);
  const unmarked = programProgress(
    confirming,
    buildSnapshot([record("COMP 330", "completed")]),
    catalogue,
  ).groups;
  expect(unmarked.map((group) => [group.satisfied, group.unparsed])).toEqual([
    [false, 1],
    [false, 1],
    [false, 1],
    [false, 0],
  ]);
});

test("a range keeps counting past its lower bound toward the program total, and a program below its total is not met", () => {
  const ranged: Program = {
    ...tiny,
    credits: 9,
    groups: [
      {
        title: "Thesis Courses",
        kind: "complementary",
        credits: 3,
        maxCredits: 6,
        rules: [{ title: "Thesis Courses", courses: ["COMP 250", "COMP 330"] }],
      },
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 3,
        rules: [{ title: "Theory", courses: ["COMP 330", "COMP 202"] }],
      },
    ],
  };
  const done = (...codes: string[]) =>
    programProgress(
      ranged,
      buildSnapshot(codes.map((code) => record(code, "completed"))),
      catalogue,
    );
  const short = done("COMP 250", "COMP 202");
  expect(short.groups.map((group) => group.satisfied)).toEqual([true, true]);
  expect(short).toMatchObject({ creditsDone: 6, satisfied: false });
  const full = done("COMP 250", "COMP 202", "COMP 330");
  expect(full.groups[0]).toMatchObject({ creditsDone: 6, maxCredits: 6 });
  expect(full).toMatchObject({ creditsDone: 9, satisfied: true });
  const snapshot = buildSnapshot([]);
  expect(creditSplit(full.groups[0] as GroupProgress, snapshot).completed).toBe(
    3,
  );
  expect(programSplit(full, snapshot).completed).toBe(9);
  // The range takes only what the later group did not need.
  expect(done("COMP 250", "COMP 330").groups[1]?.courses).toEqual([
    { code: "COMP 330", credits: 3 },
  ]);
});

test("a reminder counts no course, and a group of unparsed rules and reminders is met once its checks are", () => {
  const checks: Program = {
    ...tiny,
    credits: 6,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          {
            title:
              "3 credits in advanced research methods at the 600 level or higher",
            unparsed: true,
          },
          {
            title:
              "It may be taken in any academic unit at McGill or another university, subject to the approval of the Graduate Program or School Director",
            match: {},
            adviser: true,
          },
        ],
      },
    ],
  };
  const group = checks.groups[0] as ComplementaryGroup;
  const records = [record("COMP 250", "completed")];
  const [open] = programProgress(
    checks,
    buildSnapshot(records),
    catalogue,
  ).groups;
  expect(open).toMatchObject({ creditsDone: 0, satisfied: false, unparsed: 1 });
  const key = checkKey(checks, group, group.rules[0] as Rule);
  const met = programProgress(
    checks,
    buildSnapshot(records, [], null, [key]),
    catalogue,
  );
  expect(met).toMatchObject({ creditsDone: 6, satisfied: true });
  expect(met.groups[0]).toMatchObject({ confirmed: true, courses: [] });
});

test("courses listed under a rule count first, up to the group's credits, and the check stays the student's", () => {
  const raw: Rule = {
    title: "32 credits of graduate-level courses",
    unparsed: true,
  };
  const listing: Program = {
    ...tiny,
    groups: [
      {
        title: "Electives",
        kind: "complementary",
        credits: 3,
        rules: [{ title: "Any COMP course", match: { subjects: ["COMP"] } }],
      },
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [raw],
      },
    ],
  };
  const key = checkKey(listing, listing.groups[1] as ComplementaryGroup, raw);
  const assigned = { [key]: ["COMP 330", "COMP 250", "COMP 202"] };
  const count = (checked: string[] = []) =>
    programProgress(
      listing,
      buildSnapshot(records, [], null, checked, assigned),
      catalogue,
      { inProgress: true },
    );
  const progress = count();
  const [electives, listed] = progress.groups;
  // Electives comes first yet leaves the listed courses to their rule, and COMP 202, past the group's 6 credits, stays with no group.
  expect(electives?.courses).toEqual([]);
  expect(progress.unclaimed).toEqual([{ code: "COMP 202", credits: 3 }]);
  expect(listed).toMatchObject({
    creditsDone: 6,
    satisfied: false,
    unparsed: 1,
  });
  expect(listed?.rules[0]?.courses.map((c) => c.code)).toEqual([
    "COMP 330",
    "COMP 250",
  ]);
  expect(listed?.rules[0]?.listed?.map((c) => c.code)).toEqual(assigned[key]);
  expect(count([key]).groups[1]).toMatchObject({
    satisfied: true,
    confirmed: true,
  });
  // Unlisted, the same courses go to the first group that takes them.
  const plain = programProgress(listing, snapshot, catalogue).groups;
  expect(plain.map((group) => group.creditsDone)).toEqual([3, 0]);

  // The course picked for the replace group is claimed before any group counts greedily.
  const replaced = programProgress(
    tiny,
    buildSnapshot(records, [], null, [], { [replaceKey(tiny)]: ["COMP 330"] }),
    catalogue,
  ).groups;
  expect(replaced.map((g) => [g.title, g.creditsDone])).toEqual([
    ["Required Courses", 3],
    ["Complementary Courses", 0],
    [REPLACE_TITLE, 3],
  ]);
});

test("an adviser rule next to a list adds approved courses up to its credits and never caps the list", () => {
  const approved = {
    title: "3 credits, chosen in consultation with the academic adviser",
    minCredits: 3,
    maxCredits: 3,
    match: {},
    adviser: true as const,
  };
  const withAdviser: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 9,
        rules: [
          { title: "Theory", courses: ["COMP 330", "COMP 350"] },
          approved,
        ],
      },
    ],
  };
  const [group] = programProgress(withAdviser, snapshot, catalogue, {
    inProgress: true,
  }).groups;
  // COMP 330 is on the list, COMP 250 is the one approved extra, and COMP 202 is past the adviser's 3 credits.
  expect(group?.courses.map((c) => c.code)).toEqual(["COMP 250", "COMP 330"]);
  expect(group?.rules[1]).toMatchObject({ adviser: true, satisfied: true });
});

const spread = (rule: Rule, ...codes: string[]) => {
  const program: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          { title: "List", courses: ["COMP 250", "COMP 330", "MATH 240"] },
          rule,
        ],
      },
    ],
  };
  const done = buildSnapshot(codes.map((code) => record(code, "completed")));
  return programProgress(program, done, catalogue).groups[0];
};

test("a cap per subject leaves out a second course of the same subject", () => {
  const group = spread(
    {
      title: "No more than 3 credits from any one discipline",
      maxCreditsPerSubject: 3,
      match: {},
    },
    "COMP 250",
    "COMP 330",
    "MATH 240",
  );
  expect(group?.courses.map((c) => c.code)).toEqual(["COMP 250", "MATH 240"]);
});

test("a rule over several subjects is met only once its courses span them", () => {
  const rule = {
    title: "Drawn from at least 2 disciplines",
    minCredits: 6,
    minSubjects: 2,
    match: {},
  };
  expect(spread(rule, "COMP 250", "COMP 330", "MATH 240")).toMatchObject({
    satisfied: true,
    rules: [{}, { satisfied: true }],
  });
  expect(spread(rule, "COMP 250", "COMP 330")).toMatchObject({
    satisfied: false,
    rules: [{}, { satisfied: false }],
  });
});

test("a not-both rule caps the lists and adds none of its own courses", () => {
  const notBoth = (a: string, b: string): Rule => ({
    title: `${a} or ${b}, but not both`,
    maxCourses: 1,
    courses: [a, b],
  });
  const codes = (rule: Rule, ...done: string[]) =>
    spread(rule, ...done)?.courses.map((c) => c.code);
  expect(
    codes(notBoth("COMP 250", "COMP 330"), "COMP 250", "COMP 330", "MATH 240"),
  ).toEqual(["COMP 250", "MATH 240"]);
  // COMP 424 is named only by the footnote, never by a list.
  expect(
    codes(notBoth("COMP 330", "COMP 424"), "COMP 250", "COMP 424"),
  ).toEqual(["COMP 250"]);
});

test("credit sources name plain rule titles and give up on sentences", () => {
  const group = (titles: string[]) => ({
    title: "Technical Complementaries",
    kind: "complementary" as const,
    credits: 9,
    rules: titles.map((title) => ({ title, courses: ["COMP 330"] })),
  });
  expect(
    creditSources({
      ...group(["List A, 3-12 credits", "List B, at most 8 credits"]),
      rules: [
        ...group(["List A, 3-12 credits", "List B, at most 8 credits"]).rules,
        { title: "COMP 424 and ECSE 526 cannot both be taken", maxCourses: 1 },
        {
          title: "At least 6 credits at the 400 level",
          match: { minLevel: 400 },
        },
      ],
    }),
  ).toBe("List A or List B");
  expect(creditSources(group(["3 credits from the following"]))).toBeNull();
  expect(creditSources(group(["Complementary Courses"]))).toBeNull();
  expect(creditSources(group(["A", "B", "C", "D"]))).toBeNull();
});

test("a CEGEP entry credits foundation groups and drops their courses from what's next", () => {
  const foundation: Program = {
    ...tiny,
    credits: 3,
    groups: [
      {
        title: "Year 0",
        kind: "required",
        foundation: true,
        credits: 3,
        courses: ["COMP 251"],
      },
    ],
  };
  const winter = { season: "Winter", year: 2027 } as const;
  const codes = (entry: "cegep" | null) =>
    whatsNext(catalogue, snapshot, winter, foundation, entry).mustTake.map(
      (s) => s.course.code,
    );
  expect(codes(null)).toEqual(["COMP 251"]);
  expect(codes("cegep")).toEqual([]);
  expect(
    programProgress(foundation, snapshot, catalogue, { entry: "cegep" }),
  ).toMatchObject({ satisfied: true, groups: [{ credited: true }] });
});

test("plan warnings cover prerequisites, offering, restrictions, and credits", () => {
  const winter = { season: "Winter", year: 2027 } as const;
  const fall = { season: "Fall", year: 2027 } as const;
  const warnings = planWarnings(
    [
      { term: fall, courses: ["COMP 424", "ECSE 526"] },
      { term: winter, courses: ["COMP 251", "COMP 302", "COMP 350"] },
    ],
    snapshot,
    catalogue,
    6,
  );
  expect(warnings).toEqual([
    {
      kind: "prerequisite",
      term: winter,
      course: "COMP 302",
      uncertain: false,
    },
    { kind: "not-offered", term: winter, course: "COMP 350" },
    { kind: "credit-limit", term: winter, credits: 9, limit: 6 },
    { kind: "corequisite", term: fall, course: "COMP 424", uncertain: false },
    { kind: "not-offered", term: fall, course: "COMP 424" },
    {
      kind: "restriction",
      term: fall,
      course: "COMP 424",
      blockedBy: ["ECSE 526"],
    },
    {
      kind: "restriction",
      term: fall,
      course: "ECSE 526",
      blockedBy: ["COMP 424"],
    },
  ]);
});

test("a multi-term course loads each part in its own term", () => {
  const part = (code: string, term: string) => ({
    code,
    credits: 3,
    terms: [term],
  });
  const capstone = new Map([
    [
      "ECSE 458",
      course("ECSE 458", {
        credits: 6,
        parts: [
          part("ECSE 458D1", "Fall 2026"),
          part("ECSE 458D2", "Winter 2027"),
          part("ECSE 458N1", "Winter 2027"),
          part("ECSE 458N2", "Fall 2026"),
        ],
      }),
    ],
  ]);
  const fall = { season: "Fall", year: 2026 } as const;
  const winter = { season: "Winter", year: 2027 } as const;
  const terms = (start: Term) =>
    planLoads([{ term: start, courses: ["ECSE 458"] }], capstone).map(
      (load) => [load.term, load.credits],
    );
  expect(terms(fall)).toEqual([
    [fall, 3],
    [winter, 3],
  ]);
  expect(terms(winter)).toEqual([
    [winter, 3],
    [{ season: "Fall", year: 2027 }, 3],
  ]);
  expect(
    planWarnings(
      [{ term: fall, courses: ["ECSE 458"] }],
      buildSnapshot([]),
      capstone,
      17,
      fall,
    ).filter((w) => w.kind === "after-graduation"),
  ).toEqual([
    { kind: "after-graduation", term: fall, course: "ECSE 458", ends: winter },
  ]);
  expect(
    planWarnings(
      [{ term: winter, courses: ["COMP 250"] }],
      buildSnapshot([]),
      catalogue,
      17,
      fall,
    ).map((w) => w.kind),
  ).toContain("after-graduation");
});

test("the school period runs from the next term to graduation, and multi-term courses start where part 1 runs", () => {
  const label = (term: Term) => `${term.season} ${term.year}`;
  const winter2028: Term = { season: "Winter", year: 2028 };
  expect(schoolTerms(winter2028, fall2026).map(label)).toEqual([
    "Winter 2027",
    "Summer 2027",
    "Fall 2027",
    "Winter 2028",
  ]);
  const open = schoolTerms(null, fall2026);
  expect(open).toHaveLength(12);
  expect(open.at(-1)).toEqual({ season: "Fall", year: 2030 });
  expect(schoolTerms(fall2026, fall2026)).toHaveLength(12);

  const plan = [{ term: winter2028, courses: ["COMP 330"] }];
  const comp424 = termChoices(
    catalogue.get("COMP 424") as Course,
    plan,
    catalogue,
    winter2028,
    fall2026,
  );
  expect(comp424.map((c) => [label(c.term), c.offered, c.planned])).toEqual([
    ["Winter 2027", true, [0]],
    ["Summer 2027", false, [0]],
    ["Fall 2027", false, [0]],
    ["Winter 2028", true, [3]],
  ]);

  const capstone = catalogue.get("ECSE 458") as Course;
  const starts = (end: Term) =>
    termChoices(capstone, plan, catalogue, end, fall2026).map((c) => [
      c.label,
      c.endsAfter,
    ]);
  expect(starts(winter2028)).toEqual([["Fall 2027 and Winter 2028", false]]);
  expect(starts({ season: "Fall", year: 2027 })).toEqual([
    ["Fall 2027 and Winter 2028", true],
  ]);
});

test("a done first part is pending, not earned, until the next part is done", () => {
  const winter2027: Term = { season: "Winter", year: 2027 };
  const part = (
    part: string,
    term: Term,
    status: CourseRecord["status"] = "completed",
  ): CourseRecord => ({ ...record("ECSE 458", status), part, term });
  const d1 = buildSnapshot([part("D1", fall2026)]);
  expect(d1.done.has("ECSE 458")).toBe(false);
  expect(courseStatus(catalogue.get("ECSE 458") as Course, d1).status).toBe(
    "in-progress",
  );
  expect(earnedCredits(d1, catalogue)).toBe(0);
  expect(pendingCredits(d1)).toBe(3);
  expect(planWarnings([], d1, catalogue)).toEqual([
    {
      kind: "missing-part",
      term: winter2027,
      course: "ECSE 458",
      part: "D2",
      after: "D1",
      afterTerm: fall2026,
    },
  ]);

  const both = buildSnapshot([part("D1", fall2026), part("D2", winter2027)]);
  expect(both.done.has("ECSE 458")).toBe(true);
  expect(earnedCredits(both, catalogue)).toBe(6);
  expect(planWarnings([], both, catalogue)).toEqual([]);

  // A registered N1 already needs its N2 in the following Fall.
  const n1 = buildSnapshot([part("N1", winter2027, "in-progress")]);
  expect(planWarnings([], n1, catalogue)).toEqual([
    {
      kind: "missing-part",
      term: { season: "Fall", year: 2027 },
      course: "ECSE 458",
      part: "N2",
      after: "N1",
      afterTerm: winter2027,
    },
  ]);

  const j = (n: string, status: CourseRecord["status"]) => ({
    ...part(`J${n}`, fall2026, status),
    code: "MATH 470",
  });
  const running = buildSnapshot([
    j("1", "completed"),
    j("2", "completed"),
    j("3", "in-progress"),
  ]);
  expect(running.inProgress.has("MATH 470")).toBe(true);
  expect(pendingCredits(running)).toBe(6);
  expect(planWarnings([], running, catalogue)).toEqual([]);
});

test("status for 10,000 courses takes under 100 ms", () => {
  const tree = { and: ["COMP 250", { or: ["MATH 240", "MATH 223"] }] };
  const many = Array.from({ length: 10_000 }, (_, i) =>
    course(`TEST ${100 + (i % 900)}`, { prerequisites: req(tree) }),
  );
  const start = performance.now();
  for (const c of many) courseStatus(c, snapshot);
  expect(performance.now() - start).toBeLessThan(100);
});

test("a free elective group takes any course, caps MUEN and keeps music out of the non-music rule", () => {
  const electives: Program = {
    ...tiny,
    groups: [
      {
        title: "Elective Courses",
        kind: "complementary",
        credits: 9,
        rules: [
          {
            title: "3 credits of Non-Music Electives",
            minCredits: 3,
            match: { excludeSubjects: ["MUEN", "MUTH"] },
          },
          { title: "6 credits of Free Electives", minCredits: 6, match: {} },
          {
            title: "At most 2 credits of MUEN courses",
            maxCredits: 2,
            match: { subjects: ["MUEN"] },
          },
        ],
      },
    ],
  };
  expect(validateProgram(electives)).toMatchObject({ ok: true });
  const [group] = electives.groups;
  expect(group?.kind === "complementary" && namesCourses(group)).toBe(false);
  const done = buildSnapshot([
    record("MUEN 563", "completed", 2),
    record("MUEN 572", "completed", 2),
    record("MUTH 150", "completed"),
    record("COMP 250", "completed"),
  ]);
  const [progress] = programProgress(electives, done, catalogue).groups;
  expect(progress?.rules[0]?.courses).toEqual([
    { code: "COMP 250", credits: 3 },
  ]);
  expect(progress?.courses.map((c) => c.code).sort()).toEqual([
    "COMP 250",
    "MUEN 563",
    "MUTH 150",
  ]);
  expect(progress).toMatchObject({ creditsDone: 8, satisfied: false });
});

test("a subject filter caps the group's lists and adds no course of its own", () => {
  const capped: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          { title: "List", courses: ["COMP 250", "COMP 330", "MATH 240"] },
          {
            title: "At most 3 credits of COMP courses",
            maxCredits: 3,
            match: { subjects: ["COMP"] },
            filter: true,
          },
        ],
      },
    ],
  };
  expect(validateProgram(capped)).toMatchObject({ ok: true });
  const done = buildSnapshot([
    record("COMP 250", "completed"),
    record("COMP 330", "completed"),
    record("COMP 350", "completed"),
    record("MATH 240", "completed"),
  ]);
  const [group] = programProgress(capped, done, catalogue).groups;
  expect(group).toMatchObject({ creditsDone: 6, satisfied: true });
  expect(group?.courses.map((c) => c.code)).toEqual(["COMP 250", "MATH 240"]);
});

test("an option group counts each stream of several lists with the shared rules, and the best one stands for the group", () => {
  const streams: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 9,
        rules: [
          { title: "Shared", minCredits: 3, courses: ["COMP 202"] },
          {
            title: "3 credits from",
            minCredits: 3,
            courses: ["COMP 330"],
            option: "Theory",
          },
          {
            title: "3 credits from",
            minCredits: 3,
            courses: ["COMP 360"],
            option: "Theory",
          },
          {
            title: "6 credits from",
            minCredits: 6,
            courses: ["COMP 250", "COMP 251"],
            option: "Systems",
          },
        ],
      },
    ],
  };
  expect(validateProgram(streams)).toMatchObject({ ok: true });
  const [group] = streams.groups;
  expect(
    group?.kind === "complementary" &&
      validateProgram({
        ...streams,
        groups: [{ ...group, rules: group.rules.slice(0, 3) }],
      }),
  ).toMatchObject({ ok: false });
  const done = buildSnapshot([
    record("COMP 202", "completed"),
    record("COMP 330", "completed"),
    record("COMP 250", "completed"),
    record("COMP 251", "completed"),
  ]);
  const progress = programProgress(streams, done, catalogue);
  expect(progress.groups[0]).toMatchObject({
    creditsDone: 9,
    satisfied: true,
    option: "Systems",
  });
  expect(progress.groups[0]?.rules.map((rule) => rule.creditsDone)).toEqual([
    3, 3, 0, 6,
  ]);
  expect(progress.unclaimed).toEqual([{ code: "COMP 330", credits: 3 }]);
});

test("a stated amount is a target, so a course may overshoot it and other rules keep counting", () => {
  const targets: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 22,
        rules: [
          {
            title: "9 credits selected from",
            courses: ["ANAT 361", "ANAT 362", "ANAT 365"],
            minCredits: 9,
            maxCredits: 9,
          },
          {
            title: "6 credits in Psychology",
            match: { subjects: ["PSYC"] },
            minCredits: 6,
            maxCredits: 6,
          },
          {
            title: "At most 3 credits at the 200 level",
            match: { minLevel: 200, maxLevel: 200 },
            maxCredits: 3,
          },
        ],
      },
    ],
  };
  const done = buildSnapshot([
    record("ANAT 361", "completed"),
    record("ANAT 362", "completed"),
    record("ANAT 365", "completed", 4),
    record("PSYC 301", "completed"),
    record("PSYC 302", "completed"),
    record("PSYC 303", "completed"),
    record("PSYC 204", "completed"),
    record("PSYC 205", "completed"),
  ]);
  const [group] = programProgress(targets, done, catalogue).groups;
  expect(group?.rules[0]).toMatchObject({ creditsDone: 10, satisfied: true });
  expect(group?.rules[1]).toMatchObject({ creditsDone: 12, satisfied: true });
  // A real cap still holds: only one 200-level course counts.
  expect(group?.rules[2]?.creditsDone).toBe(3);
  expect(group).toMatchObject({ creditsDone: 22, satisfied: true });
});

test("a range narrower than a course is a target, so lists that share courses can both fill", () => {
  const shared: Program = {
    ...tiny,
    groups: [
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [
          {
            title: "3 credits of",
            courses: ["COMP 330", "COMP 350"],
            minCredits: 3,
            maxCredits: 3,
          },
          {
            title: "3-4 credits of",
            courses: ["COMP 250", "COMP 330", "COMP 350"],
            minCredits: 3,
            maxCredits: 4,
          },
          {
            title: "0-3 credits of",
            courses: ["COMP 250", "MATH 240"],
            maxCredits: 3,
          },
        ],
      },
    ],
  };
  const done = buildSnapshot([
    record("COMP 330", "completed"),
    record("COMP 350", "completed"),
    record("COMP 250", "completed"),
    record("MATH 240", "completed"),
  ]);
  const [group] = programProgress(shared, done, catalogue).groups;
  expect(group).toMatchObject({ creditsDone: 6, satisfied: true });
  expect(group?.courses.map((c) => c.code)).toEqual(["COMP 330", "COMP 350"]);
  // A cap with no floor still caps.
  expect(
    fitsCaps(
      shared.groups[0] as ComplementaryGroup,
      [
        { courses: [] },
        { courses: [] },
        { courses: [{ code: "COMP 250", credits: 3 }] },
      ],
      "MATH 240",
      3,
    ),
  ).toBe(false);
});
