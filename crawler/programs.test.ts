import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Course } from "../lib/catalogue/types.ts";
import type { Program } from "../lib/programs/types.ts";
import {
  programCourseCodes,
  validateProgram,
} from "../lib/programs/validate.ts";
import { programPaths } from "./discover-programs.ts";
import {
  overlapOf,
  parseProgramPage,
  statementRules,
} from "./parse-program.ts";

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
  const GRAD = "/en/graduate";
  const loc = (path: string) =>
    `<url><loc>https://coursecatalogue.mcgill.ca${path.startsWith("/") ? path : `${BASE}/${path}`}</loc></url>`;
  const sitemap = `<urlset>${[
    "science/programs/",
    "science/programs/biology/",
    "science/programs/biology/biology-major-bsc/",
    "science/programs/music-science-students/",
    "arts-science/programs/chemistry/chemistry-minor-bsc/",
    "science/programs/chemistry/chemistry-minor-bsc/",
    "science/degree-requirements/",
    "arts/programs/environment/",
    `${GRAD}/about/admissions-guidelines/`,
    `${GRAD}/science/computer-science/`,
    `${GRAD}/science/computer-science/computer-science-phd/`,
    `${GRAD}/arts/geography/geography-phd/`,
    `${GRAD}/science/geography/geography-phd/`,
    `${GRAD}/environment/`,
  ]
    .map(loc)
    .join("")}</urlset>`;
  expect(programPaths(sitemap)).toEqual([
    `${GRAD}/arts/geography/geography-phd/`,
    `${GRAD}/environment/`,
    `${GRAD}/science/computer-science/computer-science-phd/`,
    `${BASE}/arts/programs/environment/`,
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
  expect(rules.filter((rule) => rule.unparsed)).toEqual([]);
  expect(rules).toContainEqual(
    expect.objectContaining({
      title: expect.stringContaining("A or List B"),
      minCredits: 8,
      minCourses: 3,
    }),
  );
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

const read = (text: string, credits?: number) =>
  statementRules(
    text,
    (name) =>
      ({ chemistry: ["CHEM"], biology: ["BIOL"], architecture: ["ARCH"] })[
        name
      ] ?? [],
    credits,
  ).map(({ title: _, ...rule }) => rule);

test("reads level minimums and caps, and subjects at a level, from sentences", () => {
  const cases: [string, number | undefined, object[]][] = [
    [
      "At least 9 of the 15 credits must be at the 400 level or higher.",
      15,
      [{ minCredits: 9, match: { minLevel: 400 } }],
    ],
    [
      "Three credits minimum must be at the 400 or 500 level and 9 credits maximum may be at the 200 level.",
      undefined,
      [
        { minCredits: 3, match: { minLevel: 400 } },
        { maxCredits: 9, match: { minLevel: 200, maxLevel: 200 } },
      ],
    ],
    [
      "No more than 6 credits may be taken below the 300 level.",
      undefined,
      [{ maxCredits: 6, match: { maxLevel: 200 } }],
    ],
    [
      "9 credits from Geography (GEOG) courses at the 300 level or above.",
      15,
      [
        {
          minCredits: 9,
          maxCredits: 9,
          match: { minLevel: 300, subjects: ["GEOG"] },
        },
      ],
    ],
    [
      "6 credits of Chemistry courses at the 400 level or higher",
      undefined,
      [
        {
          minCredits: 6,
          maxCredits: 6,
          match: { minLevel: 400, subjects: ["CHEM"] },
        },
      ],
    ],
    [
      "6 additional credits of English (ENGL) courses, preferably courses at the 300 level or above.",
      undefined,
      [{ minCredits: 6, maxCredits: 6, match: { subjects: ["ENGL"] } }],
    ],
    [
      "6 credits, two 400-level Anthropology (ANTH) courses.",
      6,
      [
        {
          minCourses: 2,
          maxCourses: 2,
          match: { minLevel: 400, maxLevel: 400, subjects: ["ANTH"] },
        },
      ],
    ],
    // About one list of a 24-credit group, and a list that follows.
    [
      "At least 3 of these 9-12 credits must be at the 400 level or above.",
      24,
      [{ unparsed: true }],
    ],
    ["12-15 credits of 400/500 level courses:", 42, [{ unparsed: true }]],
    [
      "At least 12 credits must be from COMP courses at the 500 level or above.",
      33,
      [
        {
          minCredits: 12,
          match: { minLevel: 500, subjects: ["COMP"] },
          filter: true,
        },
      ],
    ],
    // Qualifiers in parentheses or after "of which" and "including" are clauses, and a Special Topics part stays for a person beside what reads.
    [
      "A maximum of 36 credits of 200- and 300-level courses (of which a maximum of 21 credits may be at the 200 level and a maximum of 6 credits may be Special Topic courses.)",
      undefined,
      [
        { maxCredits: 36, match: { minLevel: 200, maxLevel: 300 } },
        { maxCredits: 21, match: { minLevel: 200, maxLevel: 200 } },
        { unparsed: true },
      ],
    ],
    [
      "12 credits selected from any undergraduate-level courses with a prefix of MUCT, MUGT, MUIT, of which 6 credits must be at the 300-level or above",
      12,
      [
        {
          minCredits: 12,
          maxCredits: 12,
          match: { subjects: ["MUCT", "MUGT", "MUIT"] },
        },
        {
          minCredits: 6,
          match: { minLevel: 300, subjects: ["MUCT", "MUGT", "MUIT"] },
          filter: true,
        },
      ],
    ],
    [
      "15 credits of Biology complementary courses at the 300-500 levels, including at least 3 credits at the 400-500 levels",
      undefined,
      [
        {
          minCredits: 15,
          maxCredits: 15,
          match: { minLevel: 300, subjects: ["BIOL"] },
        },
        {
          minCredits: 3,
          match: { minLevel: 400, subjects: ["BIOL"] },
          filter: true,
        },
      ],
    ],
    [
      "6 or 9 POLI credits at the 200 level.",
      18,
      [
        {
          minCredits: 6,
          maxCredits: 9,
          match: { minLevel: 200, maxLevel: 200, subjects: ["POLI"] },
        },
      ],
    ],
  ];
  for (const [text, credits, rules] of cases) {
    expect(read(text, credits), text).toEqual(rules);
  }
});

test("reads what an adviser must approve, and leaves optional extras out", () => {
  const cases: [string, object[]][] = [
    [
      "24 credits of Geography (GEOG) courses excluding GEOG 200 and GEOG 205, selected in consultation with the Program Adviser.",
      [
        {
          minCredits: 24,
          maxCredits: 24,
          match: { subjects: ["GEOG"], exclude: ["GEOG 200", "GEOG 205"] },
          adviser: true,
        },
      ],
    ],
    [
      "9 credits of elective courses outside the School of Architecture must be completed, subject to approval by the Student Advisor.",
      [
        {
          minCredits: 9,
          maxCredits: 9,
          match: { excludeSubjects: ["ARCH"] },
          adviser: true,
        },
      ],
    ],
    [
      "or any 300- or 400-level course approved by an adviser.",
      [{ match: { minLevel: 300, maxLevel: 400 }, adviser: true }],
    ],
    // An optional extra and an approval with no amount only remind, and a set the app cannot tell apart stays text.
    [
      "A maximum of 9 credits may be from another department with the signed permission of the program adviser.",
      [{ match: {}, adviser: true }],
    ],
    [
      "Other Education courses may be included with the permission of the Program Adviser.",
      [{ match: {}, adviser: true }],
    ],
    [
      "6 credits at the 400 level or higher, chosen from the Faculty of Engineering or Faculty of Science (in consultation with the program coordinator).",
      [{ unparsed: true }],
    ],
    [
      "12 credits chosen from the following list in consultation with the Academic Adviser for the Minor:",
      [{ unparsed: true }],
    ],
  ];
  for (const [text, rules] of cases) expect(read(text), text).toEqual(rules);
  const [rule] = statementRules(
    "3 credits, chosen in consultation with the academic adviser.",
  );
  expect(
    validateProgram({
      id: "x-minor",
      name: "X",
      degree: "B.A.",
      faculty: "Arts",
      catalogueYear: "2026-2027",
      source: "https://coursecatalogue.mcgill.ca/x/",
      credits: 3,
      groups: [
        {
          title: "Electives",
          kind: "complementary",
          credits: 3,
          rules: [rule],
        },
      ],
    }),
  ).toMatchObject({ ok: true });
});

test("reads how many subjects a group must span and how much one subject may give", () => {
  expect(
    read(
      "21 credits from the Group B course lists below drawn from at least 3 disciplines with no more than 9 credits from any one discipline.",
    ),
  ).toEqual([
    { match: {}, minSubjects: 3, maxCreditsPerSubject: 9, minCredits: 21 },
  ]);
  expect(
    read(
      "No more than 6 credits in any given area (LLCU, GERM, HISP, ITAL, and RUSS) shall count toward the Minor Concentration (not including LLCU 210).",
    ),
  ).toEqual([
    {
      match: {
        subjects: ["LLCU", "GERM", "HISP", "ITAL", "RUSS"],
        exclude: ["LLCU 210"],
      },
      maxCreditsPerSubject: 6,
    },
  ]);
  expect(
    read(
      "A maximum of 6 credits from any given discipline with the exception of Indigenous Studies (INDG) courses.",
    ),
  ).toEqual([{ unparsed: true }]);
});

test("drops notices that restrict nothing the app counts, and keeps a sentence that does", () => {
  for (const text of [
    "Maximum of 6 relevant transfer credits may be accepted from approved exchange programs subject to adviser and University approval.",
    "No more than 12 POLI transfer credits can be used toward the program requirements.",
    "It is strongly recommended that students take COMP 251, as it is a prerequisite of many later computer science courses.",
    "To take a 300- or 400-level POLI course, students must have taken a 200-level POLI course in the same field.",
    "Students will register for the 6 credits offered the Winter of their participation in the field study semester.",
    "Students who have successfully completed an equivalent to MATH 222 at CEGEP or elsewhere, must replace these credits with a 3-credit elective course to satisfy the total credit requirement for the Neuroscience Major.",
  ]) {
    expect(read(text), text).toEqual([]);
  }
  expect(
    read(
      "Credits for the introductory sequence MGCR 293 and ECON 295 that are prerequisites for 300-level courses in economics do not count as part of this Minor concentration.",
    ),
  ).toEqual([{ unparsed: true }]);
});

test("reads a level range, a minimum above the lists, and subjects listed after a colon", () => {
  expect(
    read("4-6 credits from Biology courses at the 300-500 levels"),
  ).toEqual([
    {
      minCredits: 4,
      maxCredits: 6,
      match: { minLevel: 300, subjects: ["BIOL"] },
    },
  ]);
  expect(
    read("At least 9 credits must be completed at the 300-level or above:", 15),
  ).toEqual([{ minCredits: 9, match: { minLevel: 300 } }]);
  expect(
    read(
      "6 credits at the 300 level or above selected from the following disciplines:; Anthropology (ANTH), Linguistics (LING), Psychology (PSYC), or Sociology (SOCI).",
    ),
  ).toEqual([
    {
      minCredits: 6,
      maxCredits: 6,
      match: { minLevel: 300, subjects: ["ANTH", "LING", "PSYC", "SOCI"] },
    },
  ]);
});
// Structure

const programOf = (heading: string, body: string) =>
  parseProgramPage(
    `<h1 class="page-title">${heading}</h1><p>2026-2027 Undergraduate Catalogue</p><div id="coursestextcontainer">${body}</div>`,
    `${BASE}/science/programs/test/test-program/`,
  ) as Program;
const table = (...rows: string[]) =>
  `<table>${rows
    .map((row) => {
      const [code, credits = "3"] = row.split(":");
      return `<tr><td class="codecol">${code}</td><td class="hourscol">${credits}</td></tr>`;
    })
    .join("")}</table>`;
const complementary = (body: string) => {
  const [group] = programOf(
    "Test Major (B.Sc.) (30 credits)",
    `<h2>Complementary Courses (30 credits)</h2>${body}`,
  ).groups;
  return group?.kind === "complementary" ? group.rules : [];
};

test("reads the amount of a list statement in front of its table", () => {
  const list = table("ATOC 214", "ATOC 315:4", "PHYS 230", "GEOG 421");
  const cases: [string, object][] = [
    [
      "18 credits of advanced anatomy courses (AAC) selected from:",
      { minCredits: 18, maxCredits: 18 },
    ],
    ["3 or 4 credits selected from:", { minCredits: 3, maxCredits: 4 }],
    ["6 to 7 credits selected from:", { minCredits: 6, maxCredits: 7 }],
    [
      "3 credits from the following neuroscience courses:",
      { minCredits: 3, maxCredits: 3 },
    ],
    [
      "21-24 credits of courses in East Asian Literature, Culture and Society selected from the list below.",
      { minCredits: 21, maxCredits: 24 },
    ],
    [
      "All students must take (or have taken) five courses from the following:",
      { minCourses: 5, maxCourses: 5 },
    ],
    [
      "Students must take at least 3 credits from the following courses:",
      { minCredits: 3 },
    ],
    [
      "6 credits of social processes selected as follows:",
      { minCredits: 6, maxCredits: 6 },
    ],
    [
      "3 credits minimum of statistics and mathematics chosen from:",
      { minCredits: 3 },
    ],
    [
      "3 credits, one of (usually in Year 2):",
      { minCredits: 3, maxCredits: 3, minCourses: 1, maxCourses: 1 },
    ],
    [
      "3 credits in Biochemistry, one of:",
      { minCredits: 3, maxCredits: 3, minCourses: 1, maxCourses: 1 },
    ],
    [
      "9 credits of systematic physical geography",
      { minCredits: 9, maxCredits: 9 },
    ],
    [
      "0-10 credits from the following list of 200- and 300-level courses:",
      { maxCredits: 10 },
    ],
    [
      "Students in this stream may also choose a maximum of 12 credits from the following list:",
      { maxCredits: 12 },
    ],
    [
      "3 credits of Theory, Criticism, and Methods courses from the complementary list or with the permission of your department adviser.",
      { minCredits: 3, maxCredits: 3, adviser: true },
    ],
  ];
  for (const [statement, amount] of cases) {
    const rules = complementary(`<p>${statement}</p>${list}`);
    expect(rules, statement).toEqual([
      expect.objectContaining({ ...amount, courses: expect.any(Array) }),
    ]);
    expect(rules[0], statement).not.toHaveProperty("unparsed");
  }
});

test("turns the condition of a list statement into a rule over the courses it names", () => {
  const list = table(
    "ATOC 214",
    "ATOC 315",
    "EPSC 210",
    "GEOG 421",
    "PHYS 230",
  );
  const cases: [string, object[]][] = [
    [
      "12-15 credits selected from (at least 6 of which must be ATOC):",
      [{ minCredits: 6, courses: ["ATOC 214", "ATOC 315"] }],
    ],
    [
      "15 credits from the following course list, with at least 3 credits from each of subject codes ATOC, EPSC, and GEOG.",
      [
        { minCredits: 3, courses: ["ATOC 214", "ATOC 315"] },
        { minCredits: 3, courses: ["EPSC 210"] },
        { minCredits: 3, courses: ["GEOG 421"] },
      ],
    ],
    [
      "9-12 credits from the following, with 3-6 credits at the 400 level or above:",
      [{ minCredits: 3, maxCredits: 6, courses: ["GEOG 421"] }],
    ],
    [
      "15 credits selected from the list below. At least 3 credits must be taken at the 300 or 400 level.",
      [{ minCredits: 3, courses: ["ATOC 315", "GEOG 421"] }],
    ],
  ];
  for (const [statement, parts] of cases) {
    const rules = complementary(`<p>${statement}</p>${list}`);
    expect(rules, statement).toEqual([
      ...parts.map((part) => expect.objectContaining(part)),
      expect.objectContaining({
        courses: expect.arrayContaining(["PHYS 230"]),
      }),
    ]);
  }
});

test("keeps a list statement with a condition it cannot read as text to check", () => {
  for (const statement of [
    "9 credits from List A (with a maximum of 3 credits from any category)",
    "6 credits from the following (for Voice students only):",
    "Students select 15 credits from the following courses and their associated prerequisites:",
  ]) {
    const rules = complementary(`<p>${statement}</p>${table("PHYS 230")}`);
    expect(rules, statement).toContainEqual(
      expect.objectContaining({ unparsed: true, title: expect.any(String) }),
    );
    expect(
      rules.find((rule) => rule.courses),
      statement,
    ).not.toHaveProperty("minCredits");
  }
});

test("reads statements that name lists by their headings", () => {
  const rules = complementary(
    `<p>At least 9 credits must be from Groups A and B, with at least 3 credits from each:</p><ul><li>At least 3 credits and no more than 9 credits from each of Lists C and D.</li></ul>` +
      `<h3>Group A</h3>${table("MATH 222", "MATH 323")}<h3>Group B</h3>${table("COMP 330")}` +
      `<h3>List C: Zoology</h3>${table("BIOL 205")}<h3>List D: Botany</h3>${table("PLNT 304")}`,
  );
  expect(rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        minCredits: 3,
        courses: ["MATH 222", "MATH 323"],
      }),
      expect.objectContaining({ minCredits: 3, courses: ["COMP 330"] }),
      expect.objectContaining({
        minCredits: 9,
        courses: ["MATH 222", "MATH 323", "COMP 330"],
      }),
      expect.objectContaining({
        minCredits: 3,
        maxCredits: 9,
        courses: ["BIOL 205"],
      }),
      expect.objectContaining({
        minCredits: 3,
        maxCredits: 9,
        courses: ["PLNT 304"],
      }),
    ]),
  );
  expect(rules.filter((rule) => rule.unparsed)).toEqual([]);
});

test("a choice of one course under a Required heading stays in the required group", () => {
  const program = programOf(
    "Test Major (B.Sc.) (9 credits)",
    `<h2>Required Courses (9 credits)</h2>${table("ANAT 212", "BIOL 200")}<p>Select 3 credits of the following:</p>${table("BIOL 373", "MATH 203")}`,
  );
  expect(program.groups).toEqual([
    expect.objectContaining({
      kind: "required",
      courses: ["ANAT 212", "BIOL 200", { oneOf: ["BIOL 373", "MATH 203"] }],
    }),
  ]);
});

test("reads Music electives and a Foundation year listed under Prerequisite Courses", () => {
  const program = programOf(
    "Test Major (B.Mus.) (40 credits)",
    `<h2>Program Prerequisites — Foundation Program (14 credits)</h2><p>14 credits selected as described below:</p><p>6 credits of Prerequisite Courses</p><p>2 credits of Large Ensemble</p><p>6 credits of Non-Music Electives</p>` +
      `<h2>Prerequisite Courses</h2><p>6 credits, all of the courses below:</p>${table("MUTH 150", "MUHL 186")}` +
      `<h2>Elective Courses (26 credits)</h2><p>3 credits of Non-Music Electives</p><p>23 credits of Free Electives (may include 2 credits of courses with a MUEN prefix)</p>`,
  );
  expect(validateProgram(program)).toMatchObject({ ok: true });
  const [foundation, prerequisites, electives] = program.groups;
  expect(foundation).toMatchObject({
    kind: "complementary",
    foundation: true,
    credits: 8,
    rules: [
      { unparsed: true, title: "2 credits of Large Ensemble" },
      {
        minCredits: 6,
        match: { excludeSubjects: expect.arrayContaining(["MUTH", "MUEN"]) },
      },
    ],
  });
  expect(prerequisites).toMatchObject({
    kind: "required",
    foundation: true,
    credits: 6,
    courses: ["MUTH 150", "MUHL 186"],
  });
  expect(electives).toMatchObject({
    credits: 26,
    rules: [
      { minCredits: 3, match: { excludeSubjects: expect.any(Array) } },
      { minCredits: 23, match: {} },
      { maxCredits: 2, match: { subjects: ["MUEN"] } },
    ],
  });
});

test("reads streams as a group that counts one of them, each stream's lists under its name", () => {
  const streams = (second: string) =>
    programOf(
      "Test Minor (B.Eng.) (18 credits)",
      `<h2>Complementary Courses (18 credits)</h2><p>12 credits from one of the following streams.</p>` +
        `<h3>Aerodynamics Stream</h3>${table("MECH 447", "MECH 516", "MECH 532", "MECH 533")}` +
        `<h3>Avionics Stream</h3>${second}` +
        `<h3>Technical Complementaries (6 credits)</h3><p>6 credits from:</p>${table("MIME 320", "MIME 442")}`,
    );
  const read = streams(
    table("ECSE 403:4", "ECSE 408:4", "ECSE 412", "ECSE 420"),
  );
  expect(validateProgram(read)).toMatchObject({ ok: true });
  expect(read.groups).toEqual([
    expect.objectContaining({
      credits: 12,
      rules: [
        expect.objectContaining({
          title: "Aerodynamics Stream",
          minCredits: 12,
          option: "Aerodynamics Stream",
        }),
        expect.objectContaining({
          title: "Avionics Stream",
          minCredits: 12,
          option: "Avionics Stream",
        }),
      ],
    }),
    expect.objectContaining({ title: "Technical Complementaries", credits: 6 }),
  ]);
  const lists = streams(
    `<p>6 credits from:</p>${table("ECSE 403", "ECSE 408")}<p>6 credits from:</p>${table("ECSE 412", "ECSE 420")}`,
  );
  expect(validateProgram(lists)).toMatchObject({ ok: true });
  expect(lists.groups[0]).toMatchObject({
    credits: 12,
    rules: [
      { option: "Aerodynamics Stream" },
      {
        minCredits: 6,
        courses: ["ECSE 403", "ECSE 408"],
        option: "Avionics Stream",
      },
      {
        minCredits: 6,
        courses: ["ECSE 412", "ECSE 420"],
        option: "Avionics Stream",
      },
    ],
  });
});

test("streams beside other lists, and stream headings that slipped out after them, join the group as options", () => {
  const program = programOf(
    "Test Major (B.Sc.) (12 credits)",
    `<h2>Complementary Courses (12 credits)</h2><h3>Statistics</h3><p>3 credits from:</p>${table("MATH 203", "GEOG 202")}` +
      `<p>9 credits from one of the following two streams:</p>` +
      `<h2>Biological Stream</h2><p>9 credits from:</p>${table("BIOL 310", "BIOL 342", "BIOL 432")}` +
      `<h2>Physical Stream</h2><h3>Atmosphere</h3><p>6 credits from:</p>${table("ATOC 214", "ATOC 315")}<h3>Calculus</h3><p>3 credits from:</p>${table("MATH 222")}`,
  );
  expect(validateProgram(program)).toMatchObject({ ok: true });
  expect(program.groups).toHaveLength(1);
  expect(program.groups[0]).toMatchObject({
    credits: 12,
    rules: [
      { title: "Statistics: 3 credits from" },
      { option: "Biological Stream", minCredits: 9 },
      { option: "Physical Stream", title: "Atmosphere: 6 credits from" },
      { option: "Physical Stream", title: "Calculus: 3 credits from" },
    ],
  });
  const nested = programOf(
    "Test Major (B.Mus.) (19 credits)",
    `<h2>Foundation Program (19 credits)</h2><h3>Ensembles</h3><p>4 credits from courses with a MUEN prefix.</p><p>15 credits from one of the following two streams:</p>` +
      `<h3>Classical Stream</h3>${table("MUHL 186", "MUSP 140", "MUSP 141", "MUTH 150", "MUTH 151")}` +
      `<h3>Jazz Stream</h3>${table("MUJZ 160", "MUJZ 161", "MUJZ 170", "MUJZ 171", "MUJZ 187")}`,
  );
  expect(nested.groups[0]).toMatchObject({
    credits: 19,
    rules: [
      { option: "Classical Stream", minCredits: 15 },
      { option: "Jazz Stream", minCredits: 15 },
      { minCredits: 4, match: { subjects: ["MUEN"] } },
    ],
  });
});

test("a stream that opens its list to a department still asks for the stream's credits", () => {
  const program = parseProgramPage(
    `<h1 class="page-title">Test Program (B.A. &amp; Sc.) (33 credits)</h1><p>2026-2027 Undergraduate Catalogue</p><div id="coursestextcontainer">` +
      `<h2>Complementary Courses (33 credits)</h2><p>18 credits from one of the following lists: Computer Science, or Linguistics.</p><p>15 credits from any of the two lists.</p>` +
      `<h3>Computer Science</h3>${table("COMP 330", "COMP 424")}` +
      `<h3>Linguistics</h3><p>Any course at the 300, 400 or 500 level from the department of Linguistics, or from the following list:</p>${table("LING 201", "LING 210")}</div>`,
    `${BASE}/science/programs/test/test-program/`,
    { subjectsOf: (name) => (name === "linguistics" ? ["LING"] : []) },
  );
  expect(program?.groups[0]).toMatchObject({
    credits: 33,
    rules: expect.arrayContaining([
      expect.objectContaining({ option: "Computer Science", minCredits: 18 }),
      expect.objectContaining({
        option: "Linguistics",
        match: { subjects: ["LING"], minLevel: 300 },
        minCredits: 18,
      }),
    ]),
  });
});

test("adds up a required heading with no credits from one course of each choice", () => {
  const program = programOf(
    "Test Honours (B.Sc.) (24 credits)",
    `<h2>Required Courses</h2><h3>U1 Required Courses (9 credits)</h3>${table("BIOL 200", "BIOL 202")}<p>One of:</p>${table("BIOC 212", "BIOL 201")}` +
      `<h3>U3 Required Courses (15 credits)</h3>${table("MIMM 413", "MIMM 501D1:6", "MIMM 501D2:6", "MIMM 502D1:6", "MIMM 502D2:6")}` +
      `<dl><dd>Students take either MIMM 501D1 and MIMM 501D2 or MIMM 502D1 and MIMM 502D2.</dd></dl>` +
      `<h3>U3 Complementary Courses (3 credits)</h3><p>3 credits selected from:</p>${table("MIMM 414")}` +
      `<h3>Complementary Courses (3 credits)</h3><p>3 credits selected from:</p>${table("ANAT 261")}`,
  );
  expect(program.groups.map((g) => [g.kind, g.credits])).toEqual([
    ["required", 24],
    ["complementary", 3],
    ["complementary", 3],
  ]);
});

test("repairs headings that slipped a level and reads credits written beside a heading", () => {
  const program = programOf(
    "Test Major (B.Mus.) (40 credits)",
    `<h2>Complementary Studies</h2><p>9 credits</p><h3>Group A</h3><p>3 credits from the following:</p>${table("ANTH 212")}` +
      `<h2>Group B</h2><p>6 credits from the following:</p>${table("ECON 225", "HIST 207")}` +
      `<h2>Complementary Musicianship</h2><p>(2 credits)</p><p>2 credits from:</p>${table("MUSP 324:2")}` +
      `<h3>Required Courses (8 credits)</h3><h3>Diction (5 credits)</h3>${table("MUPG 209:2", "MUPG 210:3")}<h3>Theory</h3>${table("MUTH 150")}` +
      `<h2>Complementary Courses (18 or 21 credits)</h2><p>0-3 credits from:</p>${table("MATH 203")}<p>At least 6 credits selected from:</p>${table("MATH 314", "MATH 315")}` +
      `<h2>Specialization (24 credits)</h2><ul><li>Agribusiness (24 credits)</li></ul>`,
  );
  expect(program.groups.map((g) => [g.title, g.credits])).toEqual([
    ["Complementary Studies Group A", 3],
    ["Complementary Studies Group B", 6],
    ["Complementary Musicianship", 2],
    ["Required Courses", 8],
    ["Complementary Courses", 18],
  ]);
  expect(program.groups[3]).toMatchObject({
    courses: ["MUPG 209", "MUPG 210", "MUTH 150"],
  });
});

test("takes a B.Eng. program from Engineering when another faculty lists it too", () => {
  const sitemap = `<urlset>${[
    "agri-env-sci/programs/minor-programs/environmental-engineering-minor-beng/",
    "engineering/programs/minor-programs/environmental-engineering-minor-beng/",
    "arts/programs/mathematics-statistics/mathematics-honours-bsc/",
    "science/programs/mathematics-statistics/mathematics-honours-bsc/",
  ]
    .map(
      (path) =>
        `<url><loc>https://coursecatalogue.mcgill.ca${BASE}/${path}</loc></url>`,
    )
    .join("")}</urlset>`;
  expect(programPaths(sitemap)).toEqual([
    `${BASE}/arts/programs/mathematics-statistics/mathematics-honours-bsc/`,
    `${BASE}/engineering/programs/minor-programs/environmental-engineering-minor-beng/`,
  ]);
});

test("reads a French program page from its requirements tab", () => {
  const program = parseProgramPage(
    `<h1 class="page-title">Baccalauréat ès Arts (B.A.) - Concentration mineure Langue et littérature françaises (18 crédits)</h1><p>2026-2027 Undergraduate Catalogue</p>` +
      `<div id="gnralitstextcontainer">Offered by: French Language &amp; Literature (Faculty of Arts)</div><div id="exigencestextcontainer">` +
      `<h2>Cours Obligatoires (6 crédits)</h2>${table("FREN 222", "FREN 244")}` +
      `<h2>Cours Complémentaires (12 crédits)</h2><p>De 3 à 6 crédits choisis parmi les cours suivants :</p>${table("FREN 239", "FREN 320")}` +
      `<p>6 à 9 crédits choisis parmi les cours du bloc « Études ».</p><h3>Bloc: Études</h3>${table("FREN 250", "FREN 251")}</div>`,
    `${BASE}/arts/programs/french/langue-litterature-francaises-concentration-mineure-/`,
  ) as Program;
  expect(validateProgram(program)).toMatchObject({ ok: true });
  expect(program).toMatchObject({
    id: "langue-litterature-francaises-concentration-mineure",
    name: "Concentration mineure Langue et littérature françaises",
    degree: "B.A.",
    faculty: "Arts",
    credits: 18,
    groups: [
      { kind: "required", credits: 6, courses: ["FREN 222", "FREN 244"] },
      {
        kind: "complementary",
        credits: 12,
        rules: expect.arrayContaining([
          expect.objectContaining({ minCredits: 3, maxCredits: 6 }),
          expect.objectContaining({
            unparsed: true,
            title: "6 à 9 crédits choisis parmi les cours du bloc « Études »",
          }),
        ]),
      },
    ],
  });
});

test("a Foundation heading with only its total takes the courses listed under Prerequisite Courses", () => {
  const program = programOf(
    "Test Major (B.Mus./B.Ed.) (16 credits)",
    `<h2>Program Prerequisites — Foundation Program</h2><p>16 credits distributed as follows:</p>` +
      `<h2>Prerequisite Courses</h2><p>4 credits of Large Ensemble</p><p>6 credits of non-Music electives</p><p>and 6 credits in the following course list:</p>${table("MUTH 150", "MUHL 186")}`,
  );
  expect(program.groups).toEqual([
    expect.objectContaining({
      foundation: true,
      credits: 16,
      rules: [
        expect.objectContaining({
          minCredits: 6,
          maxCredits: 6,
          courses: ["MUTH 150", "MUHL 186"],
        }),
        expect.objectContaining({
          unparsed: true,
          title: "4 credits of Large Ensemble",
        }),
        expect.objectContaining({
          minCredits: 6,
          match: { excludeSubjects: expect.any(Array) },
        }),
      ],
    }),
  ]);
});

test("a subject sentence beside lists narrows them, adds its courses alone under a heading, and stays text with no list", () => {
  const rules = complementary(
    `<p>At least 12 credits must be from COMP courses at the 500 level or above.</p>` +
      `<h3>Group C</h3>${table("COMP 409", "COMP 523", "ECSE 420")}` +
      `<h3>200 Level</h3><p>A maximum of 12 credits of Anthropology (ANTH) courses at the 200 level.</p>`,
  );
  expect(rules).toContainEqual(
    expect.objectContaining({ minCredits: 12, filter: true }),
  );
  expect(rules).toContainEqual({
    title:
      "A maximum of 12 credits of Anthropology (ANTH) courses at the 200 level",
    maxCredits: 12,
    match: { minLevel: 200, maxLevel: 200, subjects: ["ANTH"] },
  });
  expect(
    complementary(
      "<p>Note: Maximum 6 credits of SEAD courses are allowed.</p>",
    ),
  ).toEqual([
    { title: "Maximum 6 credits of SEAD courses are allowed", unparsed: true },
  ]);
});

test("a level sentence under a nested heading with its own credits counts that heading's courses only", () => {
  const rules = complementary(
    `<p>6 credits from:</p>${table("ENVR 400", "ENVR 201")}` +
      `<h3>Related Courses (6 credits)</h3>${table("GEOG 302", "GEOG 408")}<p>At least 3 credits must be at the 400 level or above.</p>`,
  );
  expect(rules).toContainEqual(
    expect.objectContaining({ minCredits: 3, courses: ["GEOG 408"] }),
  );
  expect(rules.some((rule) => rule.match?.minLevel !== undefined)).toBe(false);
});

test("reads which courses cannot both count, from footnotes and from sentences", () => {
  const rules = complementary(
    `<p>15 credits from:</p>${table("BREE 529", "ENVB 529", "GEOG 201", "BIOL 540", "ENVR 540", "ENVB 210", "GEOG 305", "MUJZ 440:2", "MUJZ 441:2", "MUJZ 461D1:2", "MUJZ 461D2:2")}` +
      "<dl><dd>Note: Students may take only one of BREE 529, ENVB 529, or GEOG 201.</dd></dl>" +
      "<p>You may take only one of: BIOL 540 or ENVR 540; ENVB 210 or GEOG 305.</p>" +
      "<p>Students select either MUJZ 440 and MUJZ 441 or MUJZ 461D1 and MUJZ 461D2.</p>" +
      "<p>Students can take only one course from each set of the following courses: MIME 260, MIME 261 or CHEE 380 CHEE 515 or MIME 515</p>" +
      "<p>Students can take only one course from each set of the following courses: MIME 260, MIME 261 or CHEE 380 CHEE 515 or MIME 515</p>",
  );
  expect(
    rules.filter((rule) => rule.maxCourses === 1).map((rule) => rule.courses),
  ).toEqual([
    ["BREE 529", "ENVB 529", "GEOG 201"],
    ["BIOL 540", "ENVR 540"],
    ["ENVB 210", "GEOG 305"],
    ["MUJZ 440", "MUJZ 461"],
    ["MUJZ 441", "MUJZ 461"],
    ["MIME 260", "MIME 261", "CHEE 380"],
    ["CHEE 515", "MIME 515"],
  ]);
});

test("reads permission to take one of a set as a not-both rule, and leaves permission for all of them alone", () => {
  const rules = complementary(
    `<p>15 credits from:</p>${table("ATOC 214", "ATOC 215", "ATOC 219", "CHEM 219", "MATH 223", "MATH 247")}` +
      "<dl><dd>If chosen, students may take ATOC 219 or CHEM 219.</dd>" +
      "<dd>Note: You may take one of BREE 529, ENVB 529 or GEOG 314; you may take one of GEOG 322 or BREE 217; you may take one of ANSC 326 or BIOL 324.</dd>" +
      "<dd>If chosen, students can take one of MATH 410, and MATH 527D1/MATH 527D2, but not both.</dd>" +
      "<dd>Students may take ATOC 214 and ATOC 215.</dd>" +
      "<dd>Students take MATH 223 or MATH 247.</dd></dl>" +
      "<p>A maximum of 15 credits from 200-level courses may be used toward the Honours program. Only one of PHIL 200 or PHIL 201 may be counted toward the program.</p>" +
      "<p>Note: If chosen, you may take AGEC 200 or ECON 208.</p>",
  );
  expect(
    rules.filter((rule) => rule.maxCourses === 1).map((rule) => rule.courses),
  ).toEqual([
    ["ATOC 219", "CHEM 219"],
    ["BREE 529", "ENVB 529", "GEOG 314"],
    ["GEOG 322", "BREE 217"],
    ["ANSC 326", "BIOL 324"],
    ["MATH 410", "MATH 527"],
    ["AGEC 200", "ECON 208"],
    ["PHIL 200", "PHIL 201"],
  ]);
});

test("a line beside a list opens it to a subject, and courses not taken above join the lists before", () => {
  const rules = complementary(
    `<p>9 credits from:</p>${table("COMP 251", "MATH 240")}<p>COMP courses at the 300 level or above except COMP 396, COMP 400.</p>` +
      `<p>6 credits selected from:</p>${table("MUTH 202", "MUTH 204")}<p>6 credits selected from courses not taken above and the following:</p>${table("MUCO 575")}`,
  );
  expect(rules).toEqual([
    {
      title: "9 credits from",
      courses: ["COMP 251", "MATH 240"],
      minCredits: 9,
      maxCredits: 9,
      match: {
        subjects: ["COMP"],
        minLevel: 300,
        exclude: ["COMP 396", "COMP 400"],
      },
    },
    expect.objectContaining({ courses: ["MUTH 202", "MUTH 204"] }),
    expect.objectContaining({
      courses: ["COMP 251", "MATH 240", "MUTH 202", "MUTH 204", "MUCO 575"],
      minCredits: 6,
    }),
  ]);
});

test("a Required heading over one course stays required, and a choice it cannot read stays complementary", () => {
  const program = programOf(
    "Test Minor (B.Sc.) (19 credits)",
    `<h2>Required Course (4 credits)</h2>${table("MUIN 384:1")}<p>3 credits from the following:</p>${table("MUPG 580:1.5")}` +
      `<h2>Africa Semester (15 credits)</h2><h3>Africa Semester - Required Courses</h3><p>6 credits</p>` +
      `<p>Students select one course titled "Research in Society" and one course titled "Research in Ecology" from the courses below.</p>${table("ANTH 451", "BIOL 451", "GEOG 451")}` +
      `<h3>Africa Semester - Complementary Courses</h3><p>9 credits from:</p>${table("ANTH 416", "BIOL 405", "BIOL 428")}`,
  );
  expect(program.groups.map((g) => [g.title, g.kind, g.credits])).toEqual([
    ["Required Course", "required", 4],
    ["Africa Semester - Required Courses", "complementary", 6],
    ["Africa Semester - Complementary Courses", "complementary", 9],
    // The heading asks 4 credits of courses that add up to 2.5.
    ["Program total", "complementary", 1.5],
  ]);
});

test("credits a Year 0 heading asks for after its list join a group of their own, and a condition over the whole program is a check", () => {
  const program = programOf(
    "Test (B.Sc.) (31 credits)",
    `<h2>Required Year 0 Courses (28 credits)</h2><p>All Year 0 students must successfully complete 10 credits from the following:</p>${table("MATH 133", "MATH 140", "PHYS 131:4")}` +
      "<p>All Year 0 students must also successfully complete 18 credits as follows:</p>" +
      "<p>3 credits from among any 100- or 200-level courses with the subject codes of ATOC (Atmospheric and Oceanic Sciences), COMP (Computer Science), and EPSC (Earth and Planetary Sciences).</p>" +
      "<p>15 credits from among any 100- or 200-level courses with the subject codes of AFRI (African Studies), GSFS (Gender, Sexuality, Feminist, and Social Justice), and SOCI (Sociology).</p>" +
      "<h2>Program Requirements</h2><p>Note: Students are required to take a maximum of 30 credits at the 200 level and a minimum of 12 credits at the 400 level or higher in this program.</p>" +
      `<h2>Complementary Courses (3 credits)</h2><p>3 credits from:</p>${table("ENVR 400")}`,
  );
  expect(validateProgram(program)).toMatchObject({ ok: true });
  expect(program.groups).toMatchObject([
    { kind: "required", credits: 10 },
    {
      kind: "complementary",
      credits: 18,
      foundation: true,
      rules: [
        {
          minCredits: 3,
          match: {
            minLevel: 100,
            maxLevel: 200,
            subjects: ["ATOC", "COMP", "EPSC"],
          },
        },
        {
          minCredits: 15,
          match: {
            minLevel: 100,
            maxLevel: 200,
            subjects: ["AFRI", "GSFS", "SOCI"],
          },
        },
      ],
    },
    { title: "Program Requirements", credits: 0, rules: [{ unparsed: true }] },
    { title: "Complementary Courses", credits: 3 },
  ]);
});

test("reads statements that name a list by its letter and description, its amount, or its heading", () => {
  const rules = complementary(
    "<p>3 credits in Psychology from List A - (Behavioural Neuroscience, Cognition and Quantitative Methods)</p>" +
      "<p>6 credits (two courses) from Group C OR Group D:</p>" +
      "<p>9 credits selected from the GSFS Course List, 3 credits of which must be at the 400 or 500 level.</p>" +
      "<p>at least 6 credits must be taken from the Basic Life Sciences List,</p>" +
      `<h3>List A - (Behavioural Neuroscience, Cognition and Quantitative Methods)</h3>${table("PSYC 301", "NSCI 201")}` +
      `<h3>Group C</h3>${table("PHIL 344", "PHIL 345")}<h3>Group D</h3>${table("PHIL 360")}` +
      `<h3>GSFS</h3><p>9 credits from the following:</p>${table("GSFS 301", "GSFS 401")}` +
      `<h3>Basic Life Science</h3><p>At least 6 credits from:</p>${table("ANAT 212", "BIOL 200")}`,
  );
  expect(rules.filter((rule) => rule.unparsed)).toEqual([]);
  expect(rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        minCredits: 3,
        courses: ["PSYC 301", "NSCI 201"],
      }),
      expect.objectContaining({
        minCredits: 6,
        courses: ["PHIL 344", "PHIL 345", "PHIL 360"],
      }),
      expect.objectContaining({ minCredits: 3, courses: ["GSFS 401"] }),
    ]),
  );
});

test("a statement naming its own heading, and any of the lists, take in the lists it covers", () => {
  const rules = complementary(
    "<p>9 credits from any of the two lists.</p>" +
      `<h3>Literature and Society</h3><p>6 credits of courses in Literature and Society.</p><h4>History (HIST)</h4>${table("HIST 208")}<h4>Religion (RELG)</h4>${table("RELG 253")}` +
      `<h3>Language</h3><p>3 credits from:</p>${table("EAST 220")}`,
  );
  expect(rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        minCredits: 6,
        courses: ["HIST 208", "RELG 253"],
      }),
      expect.objectContaining({
        minCredits: 9,
        courses: ["HIST 208", "RELG 253", "EAST 220"],
      }),
    ]),
  );
});

test("a required range takes the bound the program total counts, and an Honours add-on page asks for its base program", () => {
  const ranged = programOf(
    "Test Major (B.Sc.) (26 credits)",
    `<h2>U1 Required Courses (20-24 credits)</h2>${table("BIOC 212", "BIOC 220", "CHEM 212:4", "BIOL 200", "BIOL 201", "MATH 203", "PHGY 209", "PHGY 210")}` +
      `<h2>Complementary Courses (6 credits)</h2><p>6 credits from:</p>${table("BIOL 205", "MIMM 211")}`,
  );
  expect(ranged.groups.map((g) => g.credits)).toEqual([20, 6]);
  const honours = parseProgramPage(
    `<h1 class="page-title">Test Honours (B.A.) (60 credits)</h1><p>2026-2027 Undergraduate Catalogue</p>` +
      `<div id="programoverviewtextcontainer">This program is open only to students in the B.A. Faculty Program Environment. To be eligible for Honours, students must satisfy the requirements set by their B.A. degree. In addition, students must apply.</div>` +
      `<div id="coursestextcontainer"><h2>Honours Required Courses (6 credits)</h2>${table("ENVR 495D1", "ENVR 495D2")}</div>`,
    `${BASE}/environment/programs/test/test-honours-ba/`,
  ) as Program;
  expect(validateProgram(honours)).toMatchObject({ ok: true });
  expect(honours.groups).toMatchObject([
    { kind: "required", credits: 6 },
    {
      title: "B.A. Faculty Program Environment",
      credits: 54,
      rules: [{ unparsed: true }],
    },
  ]);
});

// Graduate

const GRAD = "/en/graduate";
const graduatePage = (name: string, path: string) =>
  parseProgramPage(
    readFileSync(
      new URL(`fixtures/program-${name}.html`, import.meta.url),
      "utf8",
    ),
    `${GRAD}/${path}/`,
  ) as Program;
const graduateOf = (heading: string, body: string) =>
  parseProgramPage(
    `<h1 class="page-title">${heading}</h1><p>2026-2027 Graduate Catalogue</p><div id="programrequirementstextcontainer">${body}</div>`,
    `${GRAD}/science/test/test-program/`,
  );

test("parses a thesis master's page: its degree, and thesis courses read as a list", () => {
  const msc = graduatePage(
    "computer-science-thesis-msc",
    "science/computer-science/computer-science-thesis-msc",
  );
  expect(validateProgram(msc)).toMatchObject({ ok: true });
  expect(msc).toMatchObject({
    id: "computer-science-thesis-msc",
    name: "Computer Science (Thesis)",
    degree: "M.Sc.",
    faculty: "Science",
    credits: 45,
    level: "graduate",
    groups: [
      {
        title: "Thesis Courses",
        kind: "complementary",
        credits: 29,
        rules: [
          {
            minCredits: 29,
            maxCredits: 29,
            courses: [
              "COMP 691",
              "COMP 696",
              "COMP 697",
              "COMP 698",
              "COMP 699",
            ],
          },
        ],
      },
      { kind: "required", credits: 2, courses: ["COMP 602", "COMP 603"] },
      { title: "Complementary Courses", kind: "complementary", credits: 14 },
    ],
  });
});

test("parses a doctorate: no credit total, its thesis and requirements as checks, and required courses added up from their table", () => {
  const phd = graduatePage(
    "history-phd",
    "arts/history-classical-studies/history-phd",
  );
  expect(validateProgram(phd)).toMatchObject({ ok: true });
  expect(phd).toMatchObject({
    name: "History",
    degree: "Ph.D.",
    faculty: "Arts",
    credits: 0,
    level: "graduate",
  });
  expect(phd.groups).toEqual([
    {
      title: "Thesis",
      kind: "complementary",
      credits: 0,
      rules: [
        {
          title:
            "A thesis for the doctoral degree must constitute original scholarship and must be a distinct contribution to knowledge",
          unparsed: true,
        },
      ],
    },
    {
      title: "Required Courses",
      kind: "required",
      credits: 3,
      courses: ["HIST 701", "HIST 702", "HIST 703", "HIST 704"],
    },
    {
      title: "Complementary Courses",
      kind: "complementary",
      credits: 0,
      rules: [
        {
          title:
            "A maximum of 9 credits previously completed at the graduate level, whether at McGill or elsewhere",
          unparsed: true,
        },
        {
          title: "Up to 6 credits may be taken in another department",
          unparsed: true,
        },
      ],
    },
    {
      title: "Language Requirement",
      kind: "complementary",
      credits: 0,
      rules: [
        {
          title:
            "Ph.D. candidates must offer one foreign language for examination purposes",
          unparsed: true,
        },
      ],
    },
  ]);
});

test("reads a graduate degree from the parenthesis with dotted letters, and skips a page with no requirements", () => {
  const list = `<h2>Required Courses (45 credits)</h2>${table("MUTH 650")}`;
  expect(
    graduateOf("Music (M.A.): Theory (Non-Thesis) (45 credits)", list),
  ).toMatchObject({ name: "Music: Theory (Non-Thesis)", degree: "M.A." });
  expect(
    graduateOf(
      "Japan Management (Non-Thesis): Finance (M.B.A.) (57 credits)",
      list,
    ),
  ).toMatchObject({
    name: "Japan Management (Non-Thesis): Finance",
    degree: "M.B.A.",
  });
  expect(graduateOf("Bioengineering", "")).toBeNull();
});

test("reads graduate sentences: 700-level phrases, a 600-level cap, coursework, any department and approved alternatives", () => {
  const cases: [string, object[]][] = [
    [
      "6 credits at the 500, 600, or 700 level chosen in consultation with the Graduate Program Director.",
      [{ minCredits: 6, match: { minLevel: 500 }, adviser: true }],
    ],
    [
      "26 credits of coursework, at the 500 level or higher, chosen in consultation with the student's academic adviser or supervisor.",
      [{ minCredits: 26, match: { minLevel: 500 }, adviser: true }],
    ],
    [
      "12 credits of courses at the 500 level or higher from within and/or outside the Department in consultation with the Program Adviser.",
      [{ minCredits: 12, match: { minLevel: 500 }, adviser: true }],
    ],
    [
      "Or 3 credits at the 500 level or higher recommended by the Advisory Committee and approved by the Environment Option Committee.",
      [{ match: {}, adviser: true }],
    ],
    [
      "15 credits of SWRK courses at the 500 or 600 level.",
      [
        {
          minCredits: 15,
          maxCredits: 15,
          match: { minLevel: 500, maxLevel: 600, subjects: ["SWRK"] },
        },
      ],
    ],
    [
      "7-13 credits at the 500 or 600 level (excluding ECSE 691 to ECSE 697).",
      [{ unparsed: true }],
    ],
  ];
  for (const [text, rules] of cases) expect(read(text), text).toEqual(rules);
});

test("a reminder alone in a group counts the group's credits at the level it names", () => {
  const program = programOf(
    "Test Major (B.Sc.) (9 credits)",
    `<h2>Required Courses (3 credits)</h2>${table("BIOL 200")}` +
      "<h2>Elective Courses (6 credits)</h2><p>At the 500 level or higher, and selected in consultation with the academic adviser.</p>",
  );
  expect(program.groups[1]).toMatchObject({
    credits: 6,
    rules: [{ minCredits: 6, match: { minLevel: 500 }, adviser: true }],
  });
});

test("a range heading counts courses up to its top, and credits no group can reach become a Program total check", () => {
  const thesis = graduateOf(
    "Chemistry (Thesis) (M.Sc.) (45 credits)",
    `<h2>Thesis Courses (24-31 credits)</h2><p>At least 24 credits chosen from the following:</p>${table("CHEM 691:3", "CHEM 692:6", "CHEM 693:9", "CHEM 694:12", "CHEM 695:15")}` +
      `<h2>Required Courses (5 credits)</h2>${table("CHEM 650:1", "CHEM 651:1", "CHEM 688:3")}` +
      "<h2>Complementary Courses (9-16 credits)</h2><p>Students will normally take 9-16 credits of CHEM (or approved) courses at the 500 or 600 level.</p>",
  ) as Program;
  expect(validateProgram(thesis)).toMatchObject({ ok: true });
  expect(thesis.groups).toMatchObject([
    { title: "Thesis Courses", credits: 24, maxCredits: 31 },
    { kind: "required", credits: 5 },
    { title: "Complementary Courses", credits: 9, rules: [{ unparsed: true }] },
  ]);
  // A check counts no course, so it keeps its lower bound and the thesis top makes up the total.
  expect(thesis.groups[2]).not.toHaveProperty("maxCredits");
  expect(
    programOf(
      "Test Major (B.Sc.) (12 credits)",
      `<h2>Required Courses (6 credits)</h2>${table("BIOL 200")}<h2>Complementary Courses (3 credits)</h2><p>3 credits from:</p>${table("BIOL 300", "BIOL 301")}`,
    ).groups.at(-1),
  ).toEqual({
    title: "Program total",
    kind: "complementary",
    credits: 6,
    rules: [
      {
        title:
          "6 more credits to reach the program's 12 credits, which the catalogue page does not list in a group above",
        unparsed: true,
      },
    ],
  });
});

test("sections with no credits below a Required heading join it when their courses make up exactly what it lacks", () => {
  const required = (thesis: string) =>
    graduateOf(
      "Classics (Thesis) (M.A.) (45 credits)",
      `<h2>Required Courses (21 credits)</h2>${table("CLAS 685")}<h2>Thesis Courses</h2>${thesis}` +
        `<h2>Complementary Courses (24 credits)</h2><p>24 credits from the following:</p>${table("CLAS 610", "CLAS 612")}`,
    )?.groups[0];
  expect(required(table("CLAS 695:6", "CLAS 696:6", "CLAS 698:6"))).toEqual({
    title: "Required Courses",
    kind: "required",
    credits: 21,
    courses: ["CLAS 685", "CLAS 695", "CLAS 696", "CLAS 698"],
  });
  expect(required(table("CLAS 695:6", "CLAS 696:6"))).toMatchObject({
    courses: ["CLAS 685"],
  });
});

test("a section with no credits asks what its lists say, else a person checks what it demands, and a permission or notice stays out", () => {
  const doctorate = (section: string) =>
    graduateOf(
      "Computer Science: Bioinformatics (Ph.D.)",
      `<h2>Required Courses</h2>${table("COMP 701")}${section}`,
    )?.groups.slice(1);
  expect(
    doctorate(
      `<h2>Complementary Courses</h2><p>Two courses chosen from the following:</p>${table("BINF 621", "BMDE 652", "BTEC 555")}`,
    ),
  ).toEqual([
    {
      title: "Complementary Courses",
      kind: "complementary",
      credits: 6,
      rules: [
        {
          title: "Two courses chosen from the following",
          courses: ["BINF 621", "BMDE 652", "BTEC 555"],
          minCourses: 2,
          maxCourses: 2,
        },
      ],
    },
  ]);
  expect(
    doctorate(
      "<h2>Composition Performance</h2><p>The candidate must present a concert of his/her compositions. With the permission of the Composition Area Committee, the compositions may be presented as parts of two or three concerts.</p>",
    ),
  ).toEqual([
    {
      title: "Composition Performance",
      kind: "complementary",
      credits: 0,
      rules: [
        {
          title: "The candidate must present a concert of his/her compositions",
          unparsed: true,
        },
      ],
    },
  ]);
  expect(
    doctorate(
      `<h2>Additional Thesis Courses</h2><p>With the approval of the Associate Dean (Graduate Studies), students may take up to an additional 3 credits of thesis courses by completing one or both of:</p>${table("CMPL 618", "CMPL 619")}`,
    ),
  ).toEqual([]);
  expect(
    programOf(
      "Test Major (B.Sc.) (3 credits)",
      `<h2>Required Courses (3 credits)</h2>${table("AGEC 200")}<h2>Electives</h2><p>To meet the minimum credit requirement for the degree.</p><h2>Social Sciences and Policy</h2><p>0-3 credits from:</p>${table("ECON 205")}`,
    ).groups,
  ).toHaveLength(1);
});

test("a level sentence that is a group's only source stays for a person to check when it also names a department, a kind of course or lists that follow", () => {
  const rules = (sentence: string) =>
    (
      graduateOf(
        "Social Work (Non-Thesis) (M.S.W.) (21 credits)",
        `<h2>Complementary Courses (21 credits)</h2><p>${sentence}</p>`,
      )?.groups[0] as { rules: object[] }
    ).rules.map((rule) => ({ ...rule, title: undefined }));
  for (const sentence of [
    "21 credits of courses at the 500 or 600 level courses chosen in consultation with school adviser; up to 6 credits in total may be taken outside the School.",
    "21 credits at the 500 or 600 level, chosen as follows:",
    "Two 3-credit courses at the 500 level or higher recommended by the supervisory committee; one of which must be in quantitative methods/techniques.",
    "21 credits at the 500 level or higher in consultation with the program adviser chosen from courses offered by the Department of Integrated Studies in Education.",
  ]) {
    expect(rules(sentence), sentence).toEqual([
      { title: undefined, unparsed: true },
    ]);
  }
  expect(
    rules(
      "21 credits of courses at the 500 level or higher from within and/or outside the Department in consultation with the Program Adviser.",
    ),
  ).toEqual([
    {
      title: undefined,
      minCredits: 21,
      match: { minLevel: 500 },
      adviser: true,
    },
  ]);
});
