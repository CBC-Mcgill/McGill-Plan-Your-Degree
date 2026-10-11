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
  expect(rules.filter((rule) => rule.unparsed)).toEqual([
    expect.objectContaining({ title: expect.stringContaining("A or List B") }),
  ]);
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
    (name) => ({ chemistry: ["CHEM"], biology: ["BIOL"] })[name] ?? [],
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
    // About one list of a 24-credit group, a list that follows, and a narrowing a subject rule cannot express.
    [
      "At least 3 of these 9-12 credits must be at the 400 level or above.",
      24,
      [{ unparsed: true }],
    ],
    ["12-15 credits of 400/500 level courses:", 42, [{ unparsed: true }]],
    [
      "At least 12 credits must be from COMP courses at the 500 level or above.",
      33,
      [{ unparsed: true }],
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
      [{ minCredits: 9, maxCredits: 9, match: {}, adviser: true }],
    ],
    [
      "or any 300- or 400-level course approved by an adviser.",
      [{ match: { minLevel: 300, maxLevel: 400 }, adviser: true }],
    ],
    [
      "A maximum of 9 credits may be from another department with the signed permission of the program adviser.",
      [],
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

test("reads streams as a group that counts one of them, and leaves streams of several lists as text", () => {
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
      pickOne: true,
      rules: [
        expect.objectContaining({
          title: "Aerodynamics Stream",
          minCredits: 12,
        }),
        expect.objectContaining({ title: "Avionics Stream", minCredits: 12 }),
      ],
    }),
    expect.objectContaining({ title: "Technical Complementaries", credits: 6 }),
  ]);
  const unread = streams(
    `<p>6 credits from:</p>${table("ECSE 403", "ECSE 408")}<p>6 credits from:</p>${table("ECSE 412", "ECSE 420")}`,
  );
  expect(unread.groups).toHaveLength(1);
  expect(unread.groups[0]).not.toHaveProperty("pickOne");
  expect(unread.groups[0]).toMatchObject({
    rules: expect.arrayContaining([
      expect.objectContaining({
        unparsed: true,
        title: "12 credits from one of the following streams",
      }),
    ]),
  });
});
