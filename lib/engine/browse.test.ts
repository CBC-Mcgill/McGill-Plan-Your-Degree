import { expect, test } from "vitest";
import type { CourseSummary } from "../catalogue/types.ts";
import { chipText, type ProgramRole, sortCourses } from "./browse.ts";
import type { BrowseStatus } from "./status.ts";

const course = (code: string, terms = ["Fall 2026"]) =>
  ({
    code,
    subject: code.slice(0, 4),
    number: code.slice(5),
    terms,
  }) as CourseSummary;

const list = [
  course("PHIL 210"),
  course("COMP 202"),
  course("MATH 318"),
  course("COMP 303"),
  course("COMP 424"),
  course("COMP 307", []),
];
const status: Record<string, BrowseStatus> = {
  "COMP 202": "completed",
  "COMP 424": "locked",
};
const student = {
  states: new Map(
    Object.entries(status).map(([code, s]) => [
      code,
      { status: s, uncertain: false, blockedBy: [] },
    ]),
  ),
  inProgram: new Map<string, ProgramRole>([
    ["COMP 202", "required"],
    ["COMP 303", "required"],
    ["COMP 307", "required"],
    ["COMP 424", "required"],
    ["MATH 318", "complementary"],
  ]),
  programSubjects: new Set(["COMP", "MATH"]),
};
const codes = (view: "all" | "program") =>
  sortCourses(list, "recommended", student, view, false).map((c) => c.code);

test("recommended leads with program courses open now, required first", () => {
  expect(codes("all")).toEqual([
    "COMP 303",
    "MATH 318",
    "COMP 202",
    "COMP 307",
    "COMP 424",
    "PHIL 210",
  ]);
});

test("in my program, completed courses go last", () => {
  expect(codes("program").at(-1)).toBe("COMP 202");
});

test("set chips name the property and cap the list", () => {
  expect(chipText("level", ["100", "200", "300", "400"])).toBe(
    "Level 100, 200 and 2 more",
  );
  expect(chipText("credits", ["3"])).toBe("Credits 3");
  expect(chipText("faculty", ["Fac Dental Medicine & Oral HS"])).toBe(
    "Faculty of Dental Medicine and Oral Health Sciences",
  );
});
