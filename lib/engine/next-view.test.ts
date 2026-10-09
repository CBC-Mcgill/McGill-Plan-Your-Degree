import { expect, test } from "vitest";
import type { Course } from "../catalogue/types.ts";
import type { CourseRecord, Term } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { nextView, termSnapshot } from "./next-view.ts";
import { buildSnapshot } from "./snapshot.ts";

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
    course("COMP 250"),
    course("COMP 251", {
      prerequisites: { text: "", tree: "COMP 250", unparsed: false },
    }),
    course("COMP 302", {
      prerequisites: {
        text: "",
        tree: { and: ["COMP 250", "COMP 251"] },
        unparsed: false,
      },
    }),
    course("MATH 222"),
    course("MATH 262", { restrictions: { text: "", excludes: ["MATH 222"] } }),
  ].map((c) => [c.code, c]),
);

const done = (code: string): CourseRecord => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

const program: Program = {
  id: "tiny-major-bsc",
  name: "Tiny Major",
  degree: "B.Sc.",
  faculty: "Science",
  catalogueYear: "2026-2027",
  source: "https://coursecatalogue.mcgill.ca/en/undergraduate/science/",
  credits: 12,
  groups: [
    {
      title: "Required Courses",
      kind: "required",
      credits: 12,
      courses: ["COMP 250", "COMP 251", "COMP 302", "MATH 262"],
    },
  ],
};

const winter: Term = { season: "Winter", year: 2027 };
const fall: Term = { season: "Fall", year: 2027 };
const plan = [{ term: winter, courses: ["COMP 251"] }];
const snapshot = buildSnapshot([done("COMP 250"), done("MATH 222")], plan);

const reasons = (term: Term) => {
  const view = nextView(
    catalogue,
    termSnapshot(snapshot, plan, term),
    term,
    program,
  );
  return Object.fromEntries(
    [...view.mustTake, ...view.later].flatMap((item) =>
      "oneOf" in item ? [] : [[item.course.code, item.reason ?? "open"]],
    ),
  );
};

test("a later term counts courses planned before it as taken, and planned courses stay listed", () => {
  expect(reasons(winter)).toMatchObject({
    "COMP 251": "open",
    "COMP 302": "Needs COMP 251 first",
  });
  expect(reasons(fall)).toMatchObject({
    "COMP 251": "open",
    "COMP 302": "open",
  });
});

test("a required course blocked by a restriction asks the advisor", () => {
  expect(reasons(winter)["MATH 262"]).toBe(
    "Not open to students who have taken MATH 222. Ask your advisor whether MATH 222 counts instead.",
  );
});
