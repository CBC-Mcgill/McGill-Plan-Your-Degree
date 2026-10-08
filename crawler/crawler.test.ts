import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { checkGuardrails } from "./compare.ts";
import { mergeCourses } from "./merge.ts";
import { parseCoursePage } from "./parse-course.ts";

const page = (name: string) =>
  parseCoursePage(
    readFileSync(new URL(`fixtures/${name}.html`, import.meta.url), "utf8"),
  );

test("parses real course pages, merges multi-term parts and guards the crawl", () => {
  expect(page("comp-251")).toMatchObject({
    code: "COMP 251",
    title: "Algorithms and Data Structures",
    credits: 3,
    offeredBy: "Computer Science",
    faculty: "Faculty of Science",
    terms: ["Fall 2026", "Winter 2027"],
    prerequisites: {
      tree: { and: ["COMP 250", { or: ["MATH 235", "MATH 240"] }] },
      unparsed: false,
    },
    restrictions: { excludes: ["COMP 252", "COMP 260"] },
  });

  const [capstone] = mergeCourses([page("ecse-458d2"), page("ecse-458d1")]);
  expect(capstone).toMatchObject({
    code: "ECSE 458",
    credits: 6,
    terms: ["Fall 2026", "Winter 2027"],
    parts: [{ code: "ECSE 458D1" }, { code: "ECSE 458D2" }],
  });

  const catalogue = Array.from({ length: 100 }, (_, i) => ({
    ...page("comp-251"),
    code: `TEST ${100 + i}`,
  }));
  expect(() => checkGuardrails(catalogue, catalogue.slice(2))).not.toThrow();
  expect(() => checkGuardrails(catalogue, catalogue.slice(3))).toThrow();
  const untitled = catalogue.map((course, i) =>
    i < 2 ? { ...course, title: "" } : course,
  );
  expect(() => checkGuardrails(catalogue, untitled)).toThrow();
});
