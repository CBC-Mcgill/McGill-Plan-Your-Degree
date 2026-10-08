import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { logicalCode } from "../profile/types.ts";
import type { Course, RequirementTree } from "./types.ts";

const COURSES_DIR = join(process.cwd(), "data/catalogue/courses");

let catalogue: Promise<ReadonlyMap<string, Course>> | undefined;
let unlockIndex: Promise<ReadonlyMap<string, Set<string>>> | undefined;

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

export function leaves(tree: RequirementTree): string[] {
  if (typeof tree === "string") return [tree];
  return ("and" in tree ? tree.and : tree.or).flatMap(leaves);
}

/** Each required course code mapped to the codes of the courses that require it, read once per process. */
function indexUnlocks(): Promise<ReadonlyMap<string, Set<string>>> {
  unlockIndex ??= loadCatalogue()
    .then((catalogue) => {
      const index = new Map<string, Set<string>>();
      for (const course of catalogue.values()) {
        const tree = course.prerequisites?.tree;
        if (!tree) continue;
        for (const leaf of leaves(tree)) {
          // A part such as ECON 352D1 counts toward ECON 352.
          const required = logicalCode(leaf);
          const unlocked = index.get(required) ?? new Set<string>();
          index.set(required, unlocked.add(course.code));
        }
      }
      return index;
    })
    .catch((error) => {
      unlockIndex = undefined;
      throw error;
    });
  return unlockIndex;
}

/** The sorted codes of the courses that list this one as a prerequisite. */
export async function getUnlocks(code: string): Promise<string[]> {
  const index = await indexUnlocks();
  return [...(index.get(code) ?? [])].filter((other) => other !== code).sort();
}
