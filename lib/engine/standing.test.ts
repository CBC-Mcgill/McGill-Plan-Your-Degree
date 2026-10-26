import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import meta from "../../data/catalogue/meta.json";
import type { Course } from "../catalogue/types.ts";
import type { CourseRecord, Profile, Season } from "../profile/types.ts";
import { getProgram } from "../programs/index.ts";
import type { ComplementaryGroup, Program, Rule } from "../programs/types.ts";
import {
  degreeCredits,
  degreeStanding,
  earnedCredits,
  requirementSplit,
  requirementsMet,
  roomLeft,
  standingCredits,
} from "./credits.ts";
import {
  checkKey,
  minorOverlap,
  programStanding,
  secondOverlaps,
} from "./progress.ts";
import { buildSnapshot } from "./snapshot.ts";
import { canTakeNow } from "./status.ts";

const dir = new URL("../../data/catalogue/courses/", import.meta.url);
const catalogue = new Map(
  readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file): Course[] =>
      JSON.parse(readFileSync(new URL(file, dir), "utf8")),
    )
    .map((course) => [course.code, course]),
);

const record = (
  code: string,
  season: Season,
  year: number,
  status: CourseRecord["status"] = "completed",
): CourseRecord => ({
  code,
  term: { season, year },
  credits: 3,
  grade: status === "completed" ? "A" : null,
  status,
  source: "transcript",
});

// The synthetic csMajor audit seed: a CEGEP student in Fall 2026 with COMP 310 planned for Winter 2027.
const profile: Pick<
  Profile,
  "records" | "plan" | "advancedStanding" | "creditsRequired" | "entry"
> = {
  records: [
    ...[
      "COMP 202",
      "MATH 240",
      "MATH 222",
      "PSYC 100",
      "ECON 208",
      "PHIL 210",
    ].map((code) => record(code, "Fall", 2025)),
    ...[
      "COMP 250",
      "COMP 206",
      "MATH 223",
      "MATH 323",
      "LING 201",
      "ANTH 202",
    ].map((code) => record(code, "Winter", 2026)),
    ...["COMP 251", "COMP 273", "COMP 302", "ECON 209"].map((code) =>
      record(code, "Fall", 2026, "in-progress"),
    ),
  ],
  plan: [{ term: { season: "Winter", year: 2027 }, courses: ["COMP 310"] }],
  advancedStanding: 0,
  creditsRequired: 90,
  entry: "cegep",
};

test("one student's progress reads 21, 30 and 33 program credits on the three bases", () => {
  const program = getProgram("computer-science-major-bsc");
  if (!program) throw new Error("missing program");
  const snapshot = buildSnapshot(profile.records, profile.plan, profile.entry);
  const standing = (basis: "earned" | "counting" | "plan") =>
    programStanding(program, snapshot, catalogue, profile.entry, basis);
  const required = (basis: "earned" | "counting" | "plan") =>
    standing(basis).groups.find((group) => group.kind === "required")?.courses
      .length;

  expect(
    (["earned", "counting", "plan"] as const).map(
      (basis) => standing(basis).creditsDone,
    ),
  ).toEqual([21, 30, 33]);
  expect([required("earned"), required("counting"), required("plan")]).toEqual([
    6, 9, 10,
  ]);
  const unclaimed = standing("plan").unclaimed;
  expect(unclaimed).toHaveLength(6);
  expect(unclaimed.reduce((sum, c) => sum + c.credits, 0)).toBe(18);
  expect(degreeStanding(snapshot, catalogue, profile, program)).toEqual({
    earned: 36,
    inProgress: 12,
    planned: 3,
    pending: 0,
    required: 90,
  });
});

test("a CEGEP engineering student's Year 0 counts once, and standing past it counts for the degree only", () => {
  const program = getProgram("computer-engineering-beng");
  if (!program) throw new Error("missing program");
  const records = ["ECSE 200", "ECSE 250", "MATH 262", "COMP 206"].map((code) =>
    record(code, "Fall", 2025),
  );
  const snapshot = buildSnapshot(records, [], "cegep");
  const progress = programStanding(
    program,
    snapshot,
    catalogue,
    "cegep",
    "earned",
  );
  const earned = (advancedStanding: number) => [
    degreeStanding(
      snapshot,
      catalogue,
      {
        records,
        plan: [],
        advancedStanding,
        creditsRequired: null,
        entry: "cegep",
      },
      program,
    ).earned,
    progress.creditsDone,
  ];

  // 12 course credits plus the 22 credited Year 0 credits. The 3 a 25-credit CEGEP lump sum leaves over count for the degree, not for the elective.
  expect(earned(0)).toEqual([34, 34]);
  expect(earned(25)).toEqual([37, 34]);
});

test("a graduate program ignores the entry, and a doctorate counts requirements met instead of credits", () => {
  const rule: Rule = {
    title: "A thesis for the doctoral degree",
    unparsed: true,
  };
  const thesis: ComplementaryGroup = {
    title: "Thesis",
    kind: "complementary",
    credits: 0,
    rules: [rule],
  };
  const doctorate: Program = {
    id: "computer-science-phd",
    name: "Computer Science",
    degree: "Ph.D.",
    faculty: "Science",
    catalogueYear: meta.catalogueYear,
    source:
      "https://coursecatalogue.mcgill.ca/en/graduate/science/computer-science/computer-science-phd/",
    credits: 0,
    level: "graduate",
    groups: [
      thesis,
      {
        title: "Required Courses",
        kind: "required",
        credits: 4,
        courses: ["COMP 604", "COMP 700", "COMP 701"],
      },
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 6,
        rules: [{ title: "graduate-level courses", match: { minLevel: 500 } }],
      },
    ],
  };
  const masters = { ...doctorate, degree: "M.Sc.", credits: 45 };
  expect(degreeCredits(null, "foundation", masters)).toBe(45);
  expect(degreeCredits(null, "cegep", doctorate)).toBeNull();
  expect(standingCredits(6, "cegep", doctorate)).toBe(6);

  const snapshot = buildSnapshot(
    [
      record("COMP 604", "Fall", 2025),
      record("COMP 700", "Fall", 2026, "in-progress"),
    ],
    [{ term: { season: "Winter", year: 2027 }, courses: ["COMP 701"] }],
    "cegep",
    [checkKey(doctorate, thesis, rule)],
  );
  const progress = programStanding(
    doctorate,
    snapshot,
    catalogue,
    "cegep",
    "plan",
  );
  expect(requirementsMet(progress)).toEqual([2, 3]);
  expect(requirementSplit(progress, snapshot)).toEqual({
    completed: 1,
    inProgress: 0,
    planned: 1,
  });
});

test("a course passed twice counts its credits once", () => {
  const snapshot = buildSnapshot([
    record("COMP 206", "Fall", 2025),
    record("COMP 206", "Winter", 2026),
  ]);
  expect(earnedCredits(snapshot, catalogue)).toBe(3);
});

test("a course not offered in the catalogue year is never Can take now", () => {
  const snapshot = buildSnapshot(profile.records, profile.plan, profile.entry);
  const course = (code: string) => {
    const found = catalogue.get(code);
    if (!found) throw new Error(code);
    return found;
  };
  expect(canTakeNow(course("COMP 280"), snapshot, meta.catalogueYear)).toBe(
    false,
  );
  expect(canTakeNow(course("COMP 330"), snapshot, meta.catalogueYear)).toBe(
    true,
  );
});

test("a minor shares the program's courses only up to its overlap cap, another second program shares them all outside Arts, and an extra minor shares with both", () => {
  const base = {
    degree: "B.Sc.",
    catalogueYear: "2026-2027",
    source: "https://example.com",
  };
  const program: Program = {
    ...base,
    id: "p-major",
    name: "P",
    faculty: "Science",
    credits: 9,
    groups: [
      {
        title: "Required",
        kind: "required",
        credits: 9,
        courses: ["COMP 202", "COMP 250", "COMP 251"],
      },
    ],
  };
  const minor = (overlap?: number, faculty = "Science"): Program => ({
    ...base,
    id: "m-minor",
    name: "M",
    faculty,
    credits: 12,
    ...(overlap !== undefined && { overlap }),
    groups: [
      {
        title: "Complementary",
        kind: "complementary",
        credits: 12,
        rules: [
          {
            title: "Any",
            courses: [
              "COMP 202",
              "COMP 250",
              "COMP 251",
              "COMP 302",
              "COMP 303",
            ],
          },
        ],
      },
    ],
  });
  const snapshot = buildSnapshot(
    ["COMP 202", "COMP 250", "COMP 251", "COMP 302"].map((code) =>
      record(code, "Fall", 2025),
    ),
    [],
    null,
  );
  const capped = minorOverlap(
    minor(3),
    program,
    snapshot,
    catalogue,
    null,
    "earned",
  );
  expect([capped.shared.size, capped.programOnly.size]).toEqual([1, 2]);
  expect(
    programStanding(
      minor(3),
      snapshot,
      catalogue,
      null,
      "earned",
      capped.programOnly,
    ).creditsDone,
  ).toBe(6);
  expect(
    minorOverlap(minor(), program, snapshot, catalogue, null, "earned")
      .programOnly.size,
  ).toBe(0);
  expect(
    minorOverlap(
      minor(undefined, "Arts"),
      program,
      snapshot,
      catalogue,
      null,
      "earned",
    ).shared.size,
  ).toBe(0);
  const shared = (second: Program, first = program) =>
    minorOverlap(second, first, snapshot, catalogue, null, "earned").shared
      .size;
  const major = { ...minor(), id: "s-major" };
  expect(shared(major)).toBe(3);
  expect(shared({ ...major, degree: "B.A." })).toBe(0);
  expect(shared(major, { ...program, faculty: "Arts" })).toBe(0);
  // An extra minor shares one cap with the program and the second program, so the second program's COMP 302 counts against it too.
  const [second, extra] = secondOverlaps(
    [major, minor(3)],
    program,
    snapshot,
    catalogue,
    null,
    "earned",
  );
  expect(second?.shared.size).toBe(3);
  expect([extra?.shared.size, extra?.programOnly.size]).toEqual([1, 3]);
  const arts = secondOverlaps(
    [{ ...major, degree: "B.A." }, minor(undefined, "Arts")],
    program,
    snapshot,
    catalogue,
    null,
    "earned",
  );
  expect(arts.map((overlap) => overlap.shared.size)).toEqual([0, 0]);
});

test("a program with every group met short of its total names the range that can take the rest", () => {
  const thesis: Program = {
    id: "chemistry-thesis-msc",
    name: "Chemistry",
    degree: "M.Sc.",
    faculty: "Science",
    catalogueYear: meta.catalogueYear,
    source:
      "https://coursecatalogue.mcgill.ca/en/graduate/science/chemistry/chemistry-thesis-msc/",
    credits: 45,
    level: "graduate",
    groups: [
      {
        title: "Thesis Courses",
        kind: "complementary",
        credits: 24,
        maxCredits: 33,
        rules: [
          {
            title: "At least 24 credits chosen from the following",
            minCredits: 24,
            courses: ["CHEM 694", "CHEM 695"],
          },
        ],
      },
      {
        title: "Required Courses",
        kind: "required",
        credits: 5,
        courses: ["CHEM 650", "CHEM 651", "CHEM 688"],
      },
      {
        title: "Complementary Courses",
        kind: "complementary",
        credits: 9,
        rules: [
          {
            title: "9 credits of CHEM courses",
            minCredits: 9,
            courses: ["CHEM 502", "CHEM 534", "CHEM 555"],
          },
        ],
      },
    ],
  };
  const taken = (code: string, credits: number) => ({
    ...record(code, "Fall", 2025),
    credits,
  });
  const progress = programStanding(
    thesis,
    buildSnapshot([
      taken("CHEM 694", 12),
      taken("CHEM 695", 15),
      taken("CHEM 650", 1),
      taken("CHEM 651", 1),
      taken("CHEM 688", 3),
      ...["CHEM 502", "CHEM 534", "CHEM 555"].map((code) => taken(code, 3)),
    ]),
    catalogue,
    null,
    "earned",
  );
  expect(progress.creditsDone).toBe(41);
  expect(roomLeft(progress)).toEqual({
    missing: 4,
    ranges: [{ title: "Thesis Courses", max: 33 }],
  });
});
