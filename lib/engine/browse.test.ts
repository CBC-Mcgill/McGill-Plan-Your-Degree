import { expect, test } from "vitest";
import type { CourseSummary } from "../catalogue/types.ts";
import {
  chipText,
  type ProgramRole,
  queryString,
  readQuery,
  sortCourses,
  viewsFor,
} from "./browse.ts";
import type { BrowseStatus } from "./status.ts";

const course = (code: string) =>
  ({ code, subject: code.slice(0, 4), number: code.slice(5) }) as CourseSummary;

const list = [
  course("PHIL 210"),
  course("MGPO 362"),
  course("COMP 202"),
  course("MATH 318"),
  course("COMP 303"),
  course("COMP 424"),
  course("COMP 307"),
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
    ["MGPO 362", "minor"],
  ]),
  canTake: new Set(["COMP 303", "MATH 318", "MGPO 362", "PHIL 210"]),
  programSubjects: new Set(["COMP", "MATH", "MGPO"]),
};
const codes = (view: "all" | "program") =>
  sortCourses(
    view === "program"
      ? list.filter((c) => student.inProgram.has(c.code))
      : list,
    "program",
    student,
    view,
    false,
  ).map((c) => c.code);

test("program first leads with courses open now: required, complementary, then the minor's", () => {
  expect(codes("all")).toEqual([
    "COMP 303",
    "MATH 318",
    "MGPO 362",
    "COMP 202",
    "COMP 307",
    "COMP 424",
    "PHIL 210",
  ]);
});

test("in my program, the minor follows the program and completed courses go last", () => {
  expect(codes("program")).toEqual([
    "COMP 303",
    "MATH 318",
    "MGPO 362",
    "COMP 307",
    "COMP 424",
    "COMP 202",
  ]);
});

test("set chips show the values only and cap the list", () => {
  expect(chipText("level", ["100", "200", "300", "400"])).toBe(
    "100, 200 and 2 more",
  );
  expect(chipText("faculty", ["Fac Dental Medicine & Oral HS"])).toBe(
    "Faculty of Dental Medicine and Oral Health Sciences",
  );
});

test("views and sorts the page does not offer fall back to the default", () => {
  const student = viewsFor(true, false);
  const old = new URLSearchParams("view=planned&sort=code&level=200");
  const query = readQuery(old, student);
  expect(query.view).toBe("can-take");
  expect(query.sort).toBe("program");
  expect(queryString(query, student)).toBe("level=200");
  expect(readQuery(old, viewsFor(true, true)).sort).toBe("code");
});
