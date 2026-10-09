import { expect, test } from "vitest";
import { indexCourses, searchCourses } from "./search.ts";
import type { CourseSummary } from "./types.ts";

const course = (code: string, title: string) =>
  ({ code, title }) as CourseSummary;

const index = indexCourses([
  course("COMP 2510", "Algorithms Lab"),
  course("PHIL 210", "Theories of Algorithms"),
  course("COMP 251", "Algorithms and Data Structures"),
  course("URBP 633", "Research Methods for Planners"),
  course("ARCH 551", "Urban Design and Planning"),
  course("AGRI 519", "Sustainable Development Plans"),
  course("MATH 122", "Calculus for Management"),
  course("ECON 122", "Management Plan 122"),
  course("GEOG 300", "Planning Studio"),
]);
const codes = (query: string) => searchCourses(index, query).map((c) => c.code);

test("search ranks exact code, code prefix, then title", () => {
  expect(codes("comp 251")).toEqual(["COMP 251", "COMP 2510"]);
  expect(codes("COMP251")).toEqual(codes("comp 251"));
  expect(codes("algorithms")).toEqual(["COMP 251", "COMP 2510", "PHIL 210"]);
});

test("a title that starts with the query beats a whole word, then a substring", () => {
  expect(codes("plan")).toEqual([
    "GEOG 300",
    "ECON 122",
    "AGRI 519",
    "ARCH 551",
    "URBP 633",
  ]);
  expect(codes("management plan")).toEqual(["ECON 122"]);
});

test("a code that merely contains the query comes last", () => {
  expect(codes("122")).toEqual(["ECON 122", "MATH 122"]);
  expect(codes("ath 12")).toEqual(["MATH 122"]);
});
