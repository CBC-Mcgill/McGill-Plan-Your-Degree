import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Course } from "../lib/catalogue/types.ts";
import { checkGuardrails, summarize } from "./compare.ts";
import { coursePaths } from "./discover.ts";
import { fetchPage, NotFoundError } from "./fetch.ts";
import { byCode, mergeCourses } from "./merge.ts";
import { type CoursePage, parseCoursePage } from "./parse-course.ts";
import { disallowedPaths, isAllowed } from "./robots.ts";

const OUT_DIR = "data/catalogue";
const COURSES_DIR = join(OUT_DIR, "courses");

async function readCatalogue(): Promise<Course[]> {
  const files = await readdir(COURSES_DIR).catch(() => []);
  const subjects = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) =>
        JSON.parse(await readFile(join(COURSES_DIR, file), "utf8")),
      ),
  );
  return subjects.flat();
}

async function writeCatalogue(courses: Course[], catalogueYear: string) {
  await rm(COURSES_DIR, { recursive: true, force: true });
  await mkdir(COURSES_DIR, { recursive: true });
  const bySubject = Map.groupBy(courses, (course) => course.subject);
  for (const [subject, list] of bySubject) {
    await writeFile(
      join(COURSES_DIR, `${subject}.json`),
      `${JSON.stringify(list.sort(byCode), null, 2)}\n`,
    );
  }
  const meta = {
    catalogueYear,
    source: "https://coursecatalogue.mcgill.ca/courses/",
    courseCount: courses.length,
    subjects: [...bySubject.keys()].sort(),
  };
  await writeFile(
    join(OUT_DIR, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
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

  const index = await fetchPage(allowed("/courses/"));
  const catalogueYear =
    /(\d{4}-\d{4}) Undergraduate Catalogue/.exec(index)?.[1] ?? null;
  if (!catalogueYear) throw new Error("Catalogue year not found on /courses/");

  const paths = coursePaths(index);
  console.log(`Found ${paths.length} course pages`);
  const pages: CoursePage[] = [];
  const missing: string[] = [];
  for (const [i, path] of paths.entries()) {
    try {
      pages.push(parseCoursePage(await fetchPage(allowed(path))));
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      missing.push(path);
    }
    if ((i + 1) % 500 === 0) console.log(`${i + 1} of ${paths.length}`);
  }
  if (missing.length > 0) {
    console.log(`Skipped ${missing.length} pages that returned 404`);
  }

  const courses = mergeCourses(pages);
  const previous = await readCatalogue();
  checkGuardrails(previous, courses);
  await writeCatalogue(courses, catalogueYear);

  const summary = summarize(previous, courses);
  console.log(summary);
  const summaryFile = process.env.CRAWL_SUMMARY_FILE;
  if (summaryFile) await writeFile(summaryFile, summary);
}

await main();
