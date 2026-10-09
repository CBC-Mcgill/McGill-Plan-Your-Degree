import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Course } from "../catalogue/types.ts";
import { guessProgram, PROGRAMS } from "./index.ts";
import { programCourseCodes, validateProgram } from "./validate.ts";

const catalogueDir = new URL("../../data/catalogue/courses/", import.meta.url);

test("every program file passes the schema", () => {
  for (const program of PROGRAMS) {
    expect(validateProgram(program), program.id).toMatchObject({ ok: true });
  }
});

test("every program course exists in the catalogue", () => {
  const codes = new Set(
    readdirSync(catalogueDir)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => {
        const courses: Course[] = JSON.parse(
          readFileSync(new URL(file, catalogueDir), "utf8"),
        );
        return courses.map((course) => course.code);
      }),
  );
  for (const program of PROGRAMS) {
    const missing = programCourseCodes(program).filter((c) => !codes.has(c));
    expect(missing, program.id).toEqual([]);
  }
});

test("guessProgram maps transcript fields to a program", () => {
  expect(
    guessProgram("Bachelor of Engineering", ["Computer Engineering"]),
  ).toBe("computer-engineering-beng");
  expect(
    guessProgram("Bachelor of Science", ["Honours Computer Science"]),
  ).toBe("computer-science-honours-bsc");
  expect(
    guessProgram("Bachelor of Arts", ["Major Computer Science"]),
  ).toBeNull();
});

test("guessProgram falls back to the program list by degree and name", () => {
  const program = (id: string, name: string, degree: string) => ({
    id,
    name,
    degree,
    faculty: "Any",
  });
  const index = [
    program("psychology-major-bsc", "Psychology Major", "B.Sc."),
    program("psychology-major-ba", "Psychology Major Concentration", "B.A."),
    program("accounting-major-bcom", "Accounting Major", "B.Com."),
    program(
      "accounting-concentration-bcom",
      "Accounting Concentration",
      "B.Com.",
    ),
    program("mechanical-engineering-beng", "Mechanical Engineering", "B.Eng."),
    program("physics-major-bsc", "Physics Major", "B.Sc."),
    program(
      "physics-major-bsc-again",
      "Physics Major",
      "B.Sc.(Ag.Env.Sc.) or B.Sc.",
    ),
  ];
  const guess = (degree: string, line: string) =>
    guessProgram(degree, [line], index);

  expect(guess("Bachelor of Science", "Major Psychology")).toBe(
    "psychology-major-bsc",
  );
  expect(guess("Bachelor of Arts", "Major Concentration Psychology")).toBe(
    "psychology-major-ba",
  );
  expect(guess("Bachelor of Commerce", "Major Accounting")).toBe(
    "accounting-major-bcom",
  );
  expect(guess("Bachelor of Engineering", "Mechanical Engineering")).toBe(
    "mechanical-engineering-beng",
  );
  expect(guess("Bachelor of Arts", "Major Accounting")).toBeNull();
  expect(guess("Bachelor of Science", "Major Physics")).toBeNull();
  expect(guessProgram(null, ["Major Psychology"], index)).toBeNull();
});
