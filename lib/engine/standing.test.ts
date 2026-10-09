import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import meta from "../../data/catalogue/meta.json";
import type { Course } from "../catalogue/types.ts";
import type { CourseRecord, Profile, Season } from "../profile/types.ts";
import { getProgram } from "../programs/index.ts";
import { degreeStanding } from "./credits.ts";
import { programStanding } from "./progress.ts";
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
