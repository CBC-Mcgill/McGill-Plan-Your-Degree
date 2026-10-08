import { expect, test } from "vitest";
import { indexCourses, searchCourses } from "./search.ts";
import type { CourseSummary } from "./types.ts";

const course = (code: string, title: string) =>
  ({ code, title }) as CourseSummary;

const index = indexCourses([
  course("COMP 2510", "Algorithms Lab"),
  course("PHIL 210", "Theories of Algorithms"),
  course("COMP 251", "Algorithms and Data Structures"),
]);

test("search ranks exact code, code prefix, then title", () => {
  const codes = (query: string) =>
    searchCourses(index, query).map((c) => c.code);
  expect(codes("comp 251")).toEqual(["COMP 251", "COMP 2510"]);
  expect(codes("COMP251")).toEqual(codes("comp 251"));
  expect(codes("algorithms")).toEqual(["COMP 251", "COMP 2510", "PHIL 210"]);
});
