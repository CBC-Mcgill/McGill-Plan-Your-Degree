import { existsSync, readdirSync, readFileSync } from "node:fs";
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

test("every program course exists in the catalogue", (ctx) => {
  if (!existsSync(catalogueDir)) {
    ctx.skip("data/catalogue/courses is not in the repo yet");
  }
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
