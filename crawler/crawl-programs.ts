import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Course } from "../lib/catalogue/types.ts";
import type { Program } from "../lib/programs/types.ts";
import { validateProgram } from "../lib/programs/validate.ts";
import {
  checkGuardrails,
  type IndexEntry,
  indexOf,
  missingCourses,
  summarize,
} from "./compare-programs.ts";
import { programPaths } from "./discover-programs.ts";
import { fetchPage, NotFoundError } from "./fetch.ts";
import { parseProgramPage } from "./parse-program.ts";
import { disallowedPaths, isAllowed } from "./robots.ts";

const PROGRAMS_DIR = "data/programs";
const GENERATED_DIR = join(PROGRAMS_DIR, "generated");
const COURSES_DIR = "data/catalogue/courses";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readCatalogue(): Promise<Course[]> {
  const files = await readdir(COURSES_DIR).catch(() => []);
  const subjects = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<Course[]>(join(COURSES_DIR, file))),
  );
  return subjects.flat();
}

/** Maps "computer science" to ["COMP"] when one subject makes up nearly all of a department's courses, so "computer science courses" is safe to read as COMP. */
function departmentSubjects(courses: Course[]): (name: string) => string[] {
  const counts = new Map<string, Map<string, number>>();
  for (const course of courses) {
    const name = (course.offeredBy ?? "").toLowerCase();
    const subjects = counts.get(name) ?? new Map<string, number>();
    subjects.set(course.subject, (subjects.get(course.subject) ?? 0) + 1);
    counts.set(name, subjects);
  }
  return (name) => {
    const subjects = [...(counts.get(name) ?? [])];
    const total = subjects.reduce((sum, [, n]) => sum + n, 0);
    const top = subjects.sort((a, b) => b[1] - a[1])[0];
    return top && top[1] / total >= 0.8 ? [top[0]] : [];
  };
}

/** The index of the same catalogue year if it exists, else of the newest earlier year. */
async function readPrevious(year: string): Promise<IndexEntry[]> {
  const years = (await readdir(GENERATED_DIR).catch(() => []))
    .filter((dir) => /^\d{4}-\d{4}$/.test(dir) && dir <= year)
    .sort();
  const latest = years.at(-1);
  if (!latest) return [];
  return readJson<IndexEntry[]>(join(GENERATED_DIR, latest, "index.json"));
}

async function readHandWritten(): Promise<Program[]> {
  const files = await readdir(PROGRAMS_DIR);
  return Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<Program>(join(PROGRAMS_DIR, file))),
  );
}

async function main() {
  const disallowed = disallowedPaths(await fetchPage("/robots.txt"));
  const allowed = (path: string) => {
    if (!isAllowed(path, disallowed)) {
      throw new Error(`robots.txt disallows ${path}`);
    }
    return path;
  };

  const paths = programPaths(await fetchPage(allowed("/sitemap.xml")));
  console.log(`Found ${paths.length} program pages`);
  const catalogue = await readCatalogue();
  const subjectsOf = departmentSubjects(catalogue);
  const programs: Program[] = [];
  const skipped: string[] = [];
  for (const [i, path] of paths.entries()) {
    try {
      const program = parseProgramPage(await fetchPage(allowed(path)), path, {
        subjectsOf,
      });
      if (program) programs.push(program);
      else skipped.push(path);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      skipped.push(path);
    }
    if ((i + 1) % 100 === 0) console.log(`${i + 1} of ${paths.length}`);
  }

  for (const program of programs) {
    const result = validateProgram(program);
    if (!result.ok) {
      throw new Error(`${program.id} is invalid: ${result.errors[0]}`);
    }
  }
  const [year] = programs.map((p) => p.catalogueYear).sort();
  if (!year || programs.some((p) => p.catalogueYear !== year)) {
    throw new Error("Program pages disagree on the catalogue year");
  }
  const previous = await readPrevious(year);
  checkGuardrails(previous, programs);

  const dir = join(GENERATED_DIR, year);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const program of programs) {
    await writeFile(
      join(dir, `${program.id}.json`),
      `${JSON.stringify(program, null, 2)}\n`,
    );
  }
  await writeFile(
    join(dir, "index.json"),
    `${JSON.stringify(indexOf(programs), null, 2)}\n`,
  );

  const hand = (await readHandWritten()).map((program) => ({
    program,
    generated: programs.find((p) => p.id === program.id),
  }));
  const summary = summarize({
    found: paths.length,
    skipped,
    programs,
    hand,
    previous,
    missing: missingCourses(programs, new Set(catalogue.map((c) => c.code))),
  });
  console.log(summary);
  const summaryFile = process.env.CRAWL_SUMMARY_FILE;
  if (summaryFile) await writeFile(summaryFile, summary);
}

await main();
