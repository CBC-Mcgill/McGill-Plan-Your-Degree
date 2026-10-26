import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Course } from "../catalogue/types.ts";
import { guessMinors, guessProgram, guessSecond, PROGRAMS } from "./index.ts";
import { isMinor, pairOf } from "./minor.ts";
import { programCourseCodes, validateProgram } from "./validate.ts";

const catalogueDir = new URL("../../data/catalogue/courses/", import.meta.url);

test("every program file passes the schema", () => {
  for (const program of PROGRAMS) {
    expect(validateProgram(program), program.id).toMatchObject({ ok: true });
  }
});

test("a graduate program may give no credit total, an undergraduate one may not", () => {
  const doctorate = {
    id: "history-phd",
    name: "History",
    degree: "Ph.D.",
    faculty: "Arts",
    catalogueYear: "2026-2027",
    source: "https://coursecatalogue.mcgill.ca/en/graduate/arts/history-phd/",
    credits: 0,
    level: "graduate",
    groups: [
      {
        title: "Required Courses",
        kind: "required",
        credits: 0,
        courses: ["HIST 702"],
      },
      {
        title: "Thesis",
        kind: "complementary",
        credits: 0,
        rules: [{ title: "A thesis for the doctoral degree", unparsed: true }],
      },
    ],
  };
  expect(validateProgram(doctorate)).toMatchObject({ ok: true });
  expect(validateProgram({ ...doctorate, level: undefined })).toMatchObject({
    ok: false,
    errors: ["program.credits: expected a number above 0"],
  });
  expect(
    validateProgram({ ...doctorate, level: "undergraduate" }),
  ).toMatchObject({ ok: false });
});

test("a range group's top is above its credits, and a group of only reminders is refused", () => {
  const program = (group: object) => ({
    id: "chemistry-thesis-msc",
    name: "Chemistry (Thesis)",
    degree: "M.Sc.",
    faculty: "Science",
    catalogueYear: "2026-2027",
    source: "https://coursecatalogue.mcgill.ca/en/graduate/science/",
    credits: 45,
    level: "graduate",
    groups: [
      { title: "Thesis Courses", kind: "complementary", credits: 24, ...group },
    ],
  });
  const thesis = [{ title: "Thesis Courses", courses: ["CHEM 690"] }];
  expect(
    validateProgram(program({ maxCredits: 33, rules: thesis })),
  ).toMatchObject({ ok: true });
  expect(
    validateProgram(program({ maxCredits: 24, rules: thesis })),
  ).toMatchObject({
    ok: false,
    errors: [
      "program.groups[0].maxCredits: expected a number above credits (24)",
    ],
  });
  expect(
    validateProgram(
      program({
        rules: [
          {
            title: "Courses chosen with the adviser",
            match: {},
            adviser: true,
          },
        ],
      }),
    ),
  ).toMatchObject({
    ok: false,
    errors: [
      "program.groups[0].rules: a group of only reminders counts no course",
    ],
  });
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
    credits: 0,
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

test("guessProgram reads a graduate degree, with thesis and non-thesis as kinds", () => {
  const program = (id: string, name: string, degree: string) => ({
    id,
    name,
    degree,
    faculty: "Science",
    credits: 45,
    level: "graduate" as const,
  });
  const index = [
    program(
      "computer-science-thesis-msc",
      "Computer Science (Thesis)",
      "M.Sc.",
    ),
    program(
      "computer-science-non-thesis-msc",
      "Computer Science (Non-Thesis)",
      "M.Sc.",
    ),
    program("computer-science-phd", "Computer Science", "Ph.D."),
    program(
      "electrical-engineering-non-thesis-meng",
      "Electrical Engineering (Non-Thesis)",
      "M.Eng.",
    ),
  ];
  const guess = (degree: string, line: string) =>
    guessProgram(degree, [line], index);

  expect(guess("Master of Science", "Computer Science - Thesis")).toBe(
    "computer-science-thesis-msc",
  );
  expect(guess("Master of Science", "Computer Science Non Thesis")).toBe(
    "computer-science-non-thesis-msc",
  );
  expect(guess("Doctor of Philosophy", "Computer Science")).toBe(
    "computer-science-phd",
  );
  expect(
    guess("Master of Engineering", "Non-Thesis Electrical Engineering"),
  ).toBe("electrical-engineering-non-thesis-meng");
  expect(guess("Master of Science", "Computer Science")).toBeNull();
});

test("isMinor reads the id or the degree, and guessMinors matches each transcript minor by name", () => {
  const program = (id: string, name: string, degree: string) => ({
    id,
    name,
    degree,
    faculty: "Any",
    credits: 0,
  });
  const index = [
    program("management-minor-beng", "Management Minor", "B.Eng."),
    program("management-minor-bsc", "Management Minor", "B.Sc."),
    program(
      "entrepreneurship-non-management-students",
      "Entrepreneurship (for Non-Management Students)",
      "Minor",
    ),
    program("computer-science-major-bsc", "Computer Science Major", "B.Sc."),
    program("statistics-minor-ba", "Statistics Minor", "B.A."),
    program(
      "langue-litterature-francaises-concentration-mineure",
      "Concentration mineure Langue et littérature françaises",
      "B.A.",
    ),
  ];
  expect(index.map(isMinor)).toEqual([true, true, true, false, true, true]);
  expect(
    guessMinors("Bachelor of Engineering", ["Minor Management"], index),
  ).toEqual(["management-minor-beng"]);
  expect(guessMinors("Bachelor of Arts", ["Minor Management"], index)).toEqual(
    [],
  );
  expect(
    guessMinors(
      "Bachelor of Arts",
      [
        "Minor Entrepreneurship (for Non-Management Students)",
        "Minor Statistics",
      ],
      index,
    ),
  ).toEqual([
    "entrepreneurship-non-management-students",
    "statistics-minor-ba",
  ]);
  expect(
    guessProgram("Bachelor of Science", ["Major Computer Science"], index),
  ).toBe("computer-science-major-bsc");
});

test("pairOf reads a minor, joint honours, two majors and a Liberal core from names and ids", () => {
  const program = (id: string, name: string, degree = "B.A.") => ({
    id,
    name,
    degree,
  });
  const engineering = program(
    "computer-engineering-beng",
    "Computer Engineering",
    "B.Eng.",
  );
  const economicsJoint = program(
    "economics-joint-honours-component-ba",
    "Economics Joint Honours Component",
  );
  const mathJoint = program(
    "mathematics-joint-honours-component-ba",
    "Mathematics Joint Honours Component",
  );
  const psychology = program(
    "psychology-major-concentration-ba",
    "Psychology Major Concentration",
  );
  const economics = program(
    "economics-major-concentration-ba",
    "Economics Major Concentration",
  );
  const core = program(
    "biology-liberal-program-core-science-component",
    "Biology, Liberal Program - Core Science Component",
    "Bachelor of Science",
  );
  const minor = program(
    "economics-minor-concentration-ba",
    "Economics Minor Concentration",
  );
  expect(pairOf(engineering, minor)).toBe("minor");
  expect(pairOf(engineering, null)).toBe("minor");
  expect(pairOf(economicsJoint, mathJoint)).toBe("joint");
  expect(pairOf(psychology, economics)).toBe("majors");
  expect(pairOf(core, minor)).toBe("liberal");
  expect(pairOf(core, mathJoint)).toBe("liberal");
  expect(pairOf(economicsJoint, economics)).toBe("other");
});

test("two program lines fill the program and the second program when one program fits each", () => {
  const program = (id: string, name: string, degree = "B.A.") => ({
    id,
    name,
    degree,
    faculty: "Arts",
    credits: 0,
  });
  const index = [
    program(
      "economics-joint-honours-component-ba",
      "Economics Joint Honours Component",
    ),
    program(
      "mathematics-joint-honours-component-ba",
      "Mathematics Joint Honours Component",
    ),
    program(
      "mathematics-joint-honours-component-bs",
      "Mathematics Joint Honours Component",
      "B.A. & Sc.",
    ),
    program(
      "psychology-major-concentration-ba",
      "Psychology Major Concentration",
    ),
    program(
      "economics-major-concentration-ba",
      "Economics Major Concentration",
    ),
  ];
  const guess = (lines: string[]) => {
    const programId = guessProgram("Bachelor of Arts", lines, index);
    return [
      programId,
      guessSecond("Bachelor of Arts", lines, programId, index),
    ];
  };
  expect(
    guess(["Joint Honours Economics", "Joint Honours Mathematics"]),
  ).toEqual([
    "economics-joint-honours-component-ba",
    "mathematics-joint-honours-component-ba",
  ]);
  expect(
    guess(["Major Concentration Psychology", "Major Concentration Economics"]),
  ).toEqual([
    "psychology-major-concentration-ba",
    "economics-major-concentration-ba",
  ]);
  expect(guess(["Major Concentration Psychology"])).toEqual([
    "psychology-major-concentration-ba",
    null,
  ]);
  expect(guess(["Joint Honours Economics", "Joint Honours History"])).toEqual([
    "economics-joint-honours-component-ba",
    null,
  ]);
});
