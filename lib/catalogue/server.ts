import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Course } from "./types.ts";

const COURSES_DIR = join(process.cwd(), "data/catalogue/courses");

let catalogue: Promise<ReadonlyMap<string, Course>> | undefined;

async function read(): Promise<ReadonlyMap<string, Course>> {
  // The data lands through its own PR, so a checkout without it builds an empty catalogue.
  const files = await readdir(COURSES_DIR).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  const subjects = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (file) => {
        const text = await readFile(join(COURSES_DIR, file), "utf8");
        return JSON.parse(text) as Course[];
      }),
  );
  return new Map(subjects.flat().map((course) => [course.code, course]));
}

/** Every course by logical code, read once per process. */
export function loadCatalogue(): Promise<ReadonlyMap<string, Course>> {
  catalogue ??= read().catch((error) => {
    catalogue = undefined;
    throw error;
  });
  return catalogue;
}

export async function getCourse(code: string): Promise<Course | undefined> {
  return (await loadCatalogue()).get(code);
}
