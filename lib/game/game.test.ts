import { expect, test } from "vitest";
import type { CourseSummary } from "../catalogue/types.ts";
import type { CourseRecord, Term } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { gameProgress, levelOf } from "./progress.ts";

const fall2026: Term = { season: "Fall", year: 2026 };
const codes = ["COMP 250", "COMP 251", "MATH 240", "MATH 133", "PHYS 101"];
const catalogue = new Map(
  codes.map((code) => [
    code,
    {
      code,
      subject: code.slice(0, 4),
      number: code.slice(5),
      title: code,
      credits: 3,
      terms: ["Fall 2026"],
    } as CourseSummary,
  ]),
);

const record = (
  code: string,
  status: CourseRecord["status"],
  credits: number | null = 3,
): CourseRecord => ({
  code,
  term: fall2026,
  credits,
  grade: null,
  status,
  source: "manual",
});

const program: Program = {
  id: "tiny-major-bsc",
  name: "Tiny Major",
  degree: "B.Sc.",
  faculty: "Science",
  catalogueYear: "2026-2027",
  source: "https://coursecatalogue.mcgill.ca/en/undergraduate/science/",
  credits: 6,
  groups: [
    {
      title: "Required Courses",
      kind: "required",
      credits: 6,
      courses: ["COMP 250", "MATH 240"],
    },
  ],
};

const play = (records: CourseRecord[], plan: Term[] = []) =>
  gameProgress(
    {
      records,
      plan: plan.map((term) => ({ term, courses: ["COMP 251"] })),
      graduationTerm: null,
      creditLimit: 17,
    },
    catalogue,
    program,
  );
const ids = (game: ReturnType<typeof play>) => game.earned.map((b) => b.id);

test("XP comes from earned credits only, and levels come every 15 credits", () => {
  const game = play(
    [
      record("COMP 250", "completed"),
      record("MATH 133", "transfer", null),
      record("MATH 240", "exemption", null),
      record("PHYS 101", "in-progress"),
    ],
    [fall2026],
  );
  expect(game.xp).toBe(600);
  expect(game.plannedXp).toBe(300);
  expect(game.level).toBe(1);

  expect(levelOf(1500)).toEqual({
    level: 2,
    xpIntoLevel: 0,
    xpToNextLevel: 1500,
  });
  expect(levelOf(4400)).toEqual({
    level: 3,
    xpIntoLevel: 1400,
    xpToNextLevel: 100,
  });
});

test("term badges follow the credits completed in one term", () => {
  const four = codes.slice(0, 4).map((code) => record(code, "completed"));
  expect(ids(play([]))).toEqual([]);
  expect(ids(play(four.slice(0, 1)))).toEqual(["first-steps"]);
  expect(ids(play(four))).toContain("term-cleared");
  expect(ids(play(four))).not.toContain("full-load");
  expect(ids(play([...four, record("PHYS 101", "completed")]))).toContain(
    "full-load",
  );
});

test("finishing the required courses earns the block and graduation badges", () => {
  expect(ids(play([record("COMP 250", "completed")]))).not.toContain(
    "graduation-ready",
  );
  const done = ids(
    play([record("COMP 250", "completed"), record("MATH 240", "completed")]),
  );
  expect(done).toContain("required-block");
  expect(done).toContain("graduation-ready");
});
