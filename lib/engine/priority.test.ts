import { expect, test } from "vitest";
import type { Course, RequirementTree } from "../catalogue/types.ts";
import type { CourseRecord, Term } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { priorities, urgency } from "./priority.ts";
import { buildSnapshot } from "./snapshot.ts";

const req = (tree: RequirementTree) => ({ text: "", tree, unparsed: false });

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
    course("COMP 202"),
    course("COMP 250", { prerequisites: req("COMP 202") }),
    course("COMP 251", {
      prerequisites: req("COMP 250"),
      corequisites: req("MATH 240"),
    }),
    course("COMP 302", {
      prerequisites: req({ or: ["MATH 235", "MATH 240"] }),
    }),
    course("COMP 360", {
      prerequisites: req("COMP 251"),
      terms: ["Winter 2027"],
    }),
    course("COMP 421", { prerequisites: req("COMP 251") }),
    course("MATH 235"),
    course("MATH 240"),
  ].map((c) => [c.code, c]),
);

const program: Program = {
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
      courses: ["COMP 250", "COMP 251", "COMP 360"],
    },
    {
      title: "Complementary Courses",
      kind: "complementary",
      credits: 6,
      rules: [{ title: "6 credits from", courses: ["COMP 302", "COMP 421"] }],
    },
  ],
};

const done: CourseRecord = {
  code: "COMP 202",
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
};
const fall2026: Term = { season: "Fall", year: 2026 };
const winter2028: Term = { season: "Winter", year: 2028 };

test("a course lists the program courses that wait on it and how late it can start", () => {
  const priorityOf = priorities(
    program,
    buildSnapshot([done]),
    catalogue,
    [],
    winter2028,
  );
  // COMP 360 runs only in Winter, so COMP 251 must start by Fall 2027 and COMP 250 by Winter 2027.
  const comp250 = priorityOf("COMP 250");
  expect(comp250).toEqual({
    dependents: [{ code: "COMP 251", kind: "required", corequisite: false }],
    latest: { season: "Winter", year: 2027 },
    chain: ["COMP 251", "COMP 360"],
    planned: null,
  });
  expect(urgency(comp250, fall2026)).toBe("soon");
  expect(priorityOf("COMP 251").dependents.map((d) => d.code)).toEqual([
    "COMP 360",
    "COMP 421",
  ]);
  // A corequisite can share COMP 251's term.
  const math240 = priorityOf("MATH 240");
  expect(math240.dependents).toEqual([
    { code: "COMP 251", kind: "required", corequisite: true },
    { code: "COMP 302", kind: "complementary", corequisite: false },
  ]);
  expect(math240.latest).toEqual({ season: "Fall", year: 2027 });
  // A complementary course is a choice, so it counts but sets no deadline.
  expect(priorityOf("MATH 235")).toEqual({
    dependents: [
      { code: "COMP 302", kind: "complementary", corequisite: false },
    ],
    latest: null,
    chain: [],
    planned: null,
  });
  expect(priorityOf("COMP 360").dependents).toEqual([]);
});

test("a planned course holds its term, a met option names no dependent, and a chain that no longer fits is late", () => {
  const plan = [
    { term: { season: "Winter", year: 2027 } as Term, courses: ["MATH 235"] },
    { term: { season: "Fall", year: 2027 } as Term, courses: ["COMP 421"] },
  ];
  const priorityOf = priorities(
    program,
    buildSnapshot([done], plan),
    catalogue,
    plan,
    winter2028,
  );
  expect(priorityOf("MATH 240").dependents.map((d) => d.code)).toEqual([
    "COMP 251",
  ]);
  // COMP 421 in Fall 2027 needs COMP 251 by Winter 2027, so COMP 250 had to come by Fall 2026.
  const comp250 = priorityOf("COMP 250");
  expect(comp250).toMatchObject({
    latest: { season: "Fall", year: 2026 },
    chain: ["COMP 251", "COMP 421"],
    planned: { season: "Fall", year: 2027 },
  });
  expect(urgency(comp250, fall2026)).toBe("late");
});

test("a Summer plan, an open choice and a corequisite loop each set the right deadline", () => {
  const choice: Program = {
    ...program,
    groups: [
      {
        title: "Required Courses",
        kind: "required",
        credits: 15,
        courses: [
          "MATH 262",
          "MATH 263",
          "MATH 314",
          { oneOf: ["COMP 360", "COMP 421"] },
        ],
      },
    ],
  };
  const loop = new Map([
    ...catalogue,
    ...[
      course("MATH 141"),
      course("MATH 262", { corequisites: req("MATH 263") }),
      course("MATH 263", {
        prerequisites: req("MATH 141"),
        corequisites: req("MATH 262"),
      }),
      course("MATH 314", { prerequisites: req("MATH 262") }),
    ].map((c) => [c.code, c] as const),
  ]);
  const snapshot = buildSnapshot([done, { ...done, code: "COMP 250" }]);
  // Either answer is fine for the open choice, so COMP 251 gets no deadline from it.
  expect(
    priorities(choice, snapshot, loop, [], winter2028)("COMP 251").latest,
  ).toBeNull();
  // Asked in either order, MATH 141 comes before MATH 263, which runs with MATH 262, which comes before MATH 314.
  for (const first of ["MATH 262", "MATH 141"]) {
    const priorityOf = priorities(choice, snapshot, loop, [], winter2028);
    priorityOf(first);
    expect(priorityOf("MATH 141").latest).toEqual({
      season: "Winter",
      year: 2027,
    });
  }
  // A choice planned in Summer settles the item, and the Winter before it is still in time.
  const plan = [
    { term: { season: "Summer", year: 2027 } as Term, courses: ["COMP 421"] },
  ];
  expect(
    priorities(
      choice,
      buildSnapshot([done, { ...done, code: "COMP 250" }], plan),
      loop,
      plan,
      winter2028,
    )("COMP 251"),
  ).toMatchObject({
    dependents: [{ code: "COMP 421" }],
    latest: { season: "Winter", year: 2027 },
    planned: { season: "Summer", year: 2027 },
  });
});
