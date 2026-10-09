import { expect, test } from "vitest";
import type { Course, Requirement } from "../catalogue/types.ts";
import type { CourseRecord, Term } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { validateProgram } from "../programs/validate.ts";
import { whatsNext } from "./next.ts";
import { planLoads, planWarnings } from "./plan.ts";
import { programProgress } from "./progress.ts";
import { buildSnapshot } from "./snapshot.ts";
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

test("program progress counts exemptions as satisfied but not as credit", () => {
  const progress = programProgress(tiny, snapshot, catalogue);
  expect(progress.satisfied).toBe(false);
  expect(progress.remaining).toEqual(["COMP 251"]);
  expect(progress.groups.map((g) => [g.creditsDone, g.credits])).toEqual([
    [3, 9],
    [3, 6],
  ]);
  const planned = buildSnapshot(records, [
    {
      term: { season: "Winter", year: 2027 },
      courses: ["COMP 251", "COMP 424"],
    },
  ]);
  expect(
    programProgress(tiny, planned, catalogue, { planned: true }).satisfied,
  ).toBe(true);
});

test("a CEGEP entry credits foundation groups and drops their courses from what's next", () => {
  const foundation: Program = {
    ...tiny,
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

test("status for 10,000 courses takes under 100 ms", () => {
  const tree = { and: ["COMP 250", { or: ["MATH 240", "MATH 223"] }] };
  const many = Array.from({ length: 10_000 }, (_, i) =>
    course(`TEST ${100 + (i % 900)}`, { prerequisites: req(tree) }),
  );
  const start = performance.now();
  for (const c of many) courseStatus(c, snapshot);
  expect(performance.now() - start).toBeLessThan(100);
});
