import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import meta from "../../data/catalogue/meta.json";
import type { Course } from "../catalogue/types.ts";
import type { CourseRecord, Profile, Season } from "../profile/types.ts";
import { getProgram } from "../programs/index.ts";
import type { Program } from "../programs/types.ts";
import { degreeStanding, earnedCredits } from "./credits.ts";
import { minorOverlap, programStanding } from "./progress.ts";
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

test("a CEGEP engineering student's degree and program credits agree, Year 0 counted once", () => {
  const program = getProgram("computer-engineering-beng");
  if (!program) throw new Error("missing program");
  const records = ["ECSE 200", "ECSE 250", "MATH 262", "COMP 206"].map((code) =>
    record(code, "Fall", 2025),
  );
  const earned = (advancedStanding: number) => {
    const snapshot = buildSnapshot(records, [], "cegep", advancedStanding);
    return [
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
      programStanding(program, snapshot, catalogue, "cegep", "earned")
        .creditsDone,
    ];
  };

  // 12 course credits plus the 22 credited Year 0 credits. A 25-credit CEGEP lump sum leaves 3 for the elective.
  expect(earned(0)).toEqual([34, 34]);
  expect(earned(25)).toEqual([37, 37]);
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

test("a minor shares the program's courses only up to its overlap cap", () => {
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
    0,
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
});
