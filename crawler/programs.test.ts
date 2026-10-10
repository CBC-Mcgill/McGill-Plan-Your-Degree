import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Course } from "../lib/catalogue/types.ts";
import type { Program } from "../lib/programs/types.ts";
import {
  programCourseCodes,
  validateProgram,
} from "../lib/programs/validate.ts";
import { programPaths } from "./discover-programs.ts";
import { overlapOf, parseProgramPage } from "./parse-program.ts";

const BASE = "/en/undergraduate";
const page = (name: string, path: string) =>
  parseProgramPage(
    readFileSync(
      new URL(`fixtures/program-${name}.html`, import.meta.url),
      "utf8",
    ),
    `${BASE}/${path}/`,
    { subjectsOf: (name) => (name === "computer science" ? ["COMP"] : []) },
  ) as Program;

test("finds program pages in the sitemap and skips department indexes", () => {
  const loc = (path: string) =>
    `<url><loc>https://coursecatalogue.mcgill.ca${BASE}/${path}</loc></url>`;
  const sitemap = `<urlset>${[
    "science/programs/",
    "science/programs/biology/",
    "science/programs/biology/biology-major-bsc/",
    "science/programs/music-science-students/",
    "arts-science/programs/chemistry/chemistry-minor-bsc/",
    "science/programs/chemistry/chemistry-minor-bsc/",
    "science/degree-requirements/",
  ]
    .map(loc)
    .join("")}</urlset>`;
  expect(programPaths(sitemap)).toEqual([
    `${BASE}/science/programs/biology/biology-major-bsc/`,
    `${BASE}/science/programs/chemistry/chemistry-minor-bsc/`,
    `${BASE}/science/programs/music-science-students/`,
  ]);
  expect(
    parseProgramPage("<html><h1>Biology</h1></html>", `${BASE}/x/`),
  ).toBeNull();
});

test("parses an Honours page: an either-or footnote and a department source", () => {
  const honours = page(
    "computer-science-honours-bsc",
    "science/programs/computer-science/computer-science-honours-bsc",
  );
  expect(validateProgram(honours)).toMatchObject({ ok: true });
  expect(honours).toMatchObject({
    id: "computer-science-honours-bsc",
    name: "Computer Science Honours",
    degree: "B.Sc.",
    faculty: "Science",
    catalogueYear: "2026-2027",
    credits: 75,
    generated: true,
    groups: [
      {
        kind: "required",
        credits: 49,
        courses: expect.arrayContaining([
          "COMP 202",
          "COMP 400",
          { oneOf: ["MATH 340", "MATH 350"] },
        ]),
      },
      {
        kind: "complementary",
        credits: 26,
        rules: [
          {
            minCredits: 6,
            maxCredits: 6,
            courses: ["MATH 318", "MATH 323", "MATH 324"],
          },
          {
            minCredits: 20,
            courses: ["ECSE 539"],
            match: { subjects: ["COMP"], minLevel: 300, exclude: ["COMP 396"] },
          },
          { minCredits: 12, match: { minLevel: 500 } },
        ],
      },
    ],
  });
});

test("parses an Engineering page: Year 0, extra credits, named lists and footnotes", () => {
  const coop = page(
    "co-op-software-engineering-beng",
    "engineering/programs/electrical-computer-engineering/co-op-software-engineering-beng",
  );
  expect(validateProgram(coop)).toMatchObject({ ok: true });
  expect(coop).toMatchObject({
    degree: "B.Eng.",
    faculty: "Engineering",
    credits: 141,
  });
  const [year0, science, , software, technical] = coop.groups;
  expect(year0).toMatchObject({
    title: "Required Year 0 Courses",
    foundation: true,
    credits: 22,
    courses: [
      "CHEM 120",
      "MATH 133",
      "MATH 140",
      "MATH 141",
      "PHYS 131",
      "PHYS 142",
    ],
  });
  expect(science).toMatchObject({
    kind: "complementary",
    foundation: true,
    credits: 3,
    rules: [
      {
        minCredits: 3,
        match: { subjects: ["ATOC", "BIOL", "CHEM", "EPSC", "ESYS", "PHYS"] },
      },
    ],
  });
  expect(software).toMatchObject({
    credits: 58,
    courses: expect.arrayContaining(["ECSE 458"]),
  });
  expect(software?.kind === "required" && software.courses).not.toContain(
    "ECSE 458D1",
  );
  expect(technical).toMatchObject({
    title: "Technical Complementaries",
    credits: 11,
    minCourses: 4,
  });
  const rules = technical?.kind === "complementary" ? technical.rules : [];
  expect(rules).toContainEqual(
    expect.objectContaining({
      title: expect.stringContaining("List A"),
      minCredits: 3,
      maxCredits: 4,
    }),
  );
  expect(rules).toContainEqual(
    expect.objectContaining({
      maxCourses: 1,
      courses: ["COMP 350", "ECSE 343"],
    }),
  );
  expect(rules.filter((rule) => rule.unparsed)).toHaveLength(2);
});

test("parses an Arts minor: lists without a stated amount and notes it cannot read", () => {
  const minor = page(
    "economics-minor-concentration-ba",
    "arts/programs/economics/economics-minor-concentration-ba",
  );
  expect(minor).toMatchObject({ degree: "B.A.", faculty: "Arts", credits: 18 });
  const [group] = minor.groups;
  expect(group).toMatchObject({
    kind: "complementary",
    credits: 18,
    rules: expect.arrayContaining([
      { title: "Group A", courses: ["ECON 208", "ECON 209", "ECON 230"] },
      expect.objectContaining({
        unparsed: true,
        title: expect.stringContaining("Group B"),
      }),
    ]),
  });
});

test("parses a Management page: two lists in one required group and a subject source", () => {
  const finance = page(
    "finance-major-bcom",
    "management/programs/majors/finance-major-bcom",
  );
  expect(finance).toMatchObject({
    degree: "B.Com.",
    faculty: "Management",
    credits: 72,
  });
  expect(finance.groups[0]).toMatchObject({
    kind: "required",
    credits: 60,
    courses: expect.arrayContaining(["MGCR 211", "FINE 342"]),
  });
  expect(finance.groups[1]).toMatchObject({
    kind: "complementary",
    credits: 12,
    rules: [
      { maxCredits: 3, courses: expect.arrayContaining(["ACCT 351"]) },
      { minCredits: 9, maxCredits: 12, match: { subjects: ["FINE"] } },
    ],
  });
});

test("every course in the generated versions of the hand-written programs is in the catalogue", () => {
  const generated = new URL("../data/programs/generated/", import.meta.url);
  const year = readdirSync(generated)
    .filter((dir) => /^\d{4}-\d{4}$/.test(dir))
    .sort()
    .at(-1);
  const catalogue = new URL("../data/catalogue/courses/", import.meta.url);
  const codes = new Set(
    readdirSync(catalogue)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) =>
        (
          JSON.parse(readFileSync(new URL(file, catalogue), "utf8")) as Course[]
        ).map((c) => c.code),
      ),
  );
  for (const id of [
    "computer-science-major-bsc",
    "computer-science-honours-bsc",
    "software-engineering-major-bsc",
    "co-op-software-engineering-beng",
    "computer-engineering-beng",
  ]) {
    const program = JSON.parse(
      readFileSync(new URL(`${year}/${id}.json`, generated), "utf8"),
    );
    expect(
      programCourseCodes(program).filter((code) => !codes.has(code)),
      id,
    ).toEqual([]);
  }
});

test("reads how many credits a minor shares with the program from its page", () => {
  const cases: [string, number | undefined][] = [
    [
      "A maximum of 9 credits of coursework in the student's Major may be double counted with this Minor.",
      9,
    ],
    [
      "of which not more than 6 credits may be counted for both the Major and the Minor programs.",
      6,
    ],
    ["Up to three courses can be double counted with the major.", 9],
    [
      "6 credits of overlap are allowed between the Minor and the primary program.",
      6,
    ],
    [
      "the Minor can be satisfied with 9 additional credits in the student's major program or a maximum of 12 credits overlap with the major program.",
      12,
    ],
    [
      "Students may use up to six credits of overlap between the Minor and their primary program.",
      6,
    ],
    ["This Minor permits no overlap with any other programs.", 0],
    [
      "The completion of 24 credits is required, of which at least 18 must not overlap with the primary program.",
      6,
    ],
    [
      "No course overlap between the Major Concentration Mathematics and the Supplementary Minor Concentration in Mathematics is permitted.",
      0,
    ],
    [
      "Generally, no more than 6 credits of overlap are permitted between the Minor and the primary program. However, the overlap restriction may be relaxed to 9 credits.",
      6,
    ],
    [
      "Note 1: A maximum of 6-7 credits can be counted for both the student's primary program and for the Minor in Neuroscience.",
      6,
    ],
    [
      "The Minor program for Science students requires the completion of 24 credits in Psychology, of which no more than 6 may overlap with the primary program.",
      6,
    ],
    [
      "Up to 6 credits (two courses) may be double-counted towards a degree program.",
      6,
    ],
    [
      "Students will find courses they may not take for credit because of a substantial overlap of material with a course in their program.",
      undefined,
    ],
    [
      "Students should consult the Course Overlap information in the Course Requirements section.",
      undefined,
    ],
  ];
  for (const [text, credits] of cases)
    expect(overlapOf(text), text).toBe(credits);
});
