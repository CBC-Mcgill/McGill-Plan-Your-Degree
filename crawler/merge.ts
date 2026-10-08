import type { Course, RequirementTree } from "../lib/catalogue/types.ts";
import type { CoursePage } from "./parse-course.ts";

const PART = /^(.+ \d{3})([DJN]\d)$/;
const SEASONS = ["Winter", "Summer", "Fall"];

function termKey(term: string): number {
  const [season = "", year = ""] = term.split(" ");
  return Number(year) * 3 + SEASONS.indexOf(season);
}

export const byCode = (a: { code: string }, b: { code: string }) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : 0;

export function sortTerms(terms: Iterable<string>): string[] {
  return [...new Set(terms)].sort((a, b) => termKey(a) - termKey(b));
}

function mapTree(
  tree: RequirementTree | null,
  rename: (code: string) => string,
  self: string,
): RequirementTree | null {
  if (tree === null) return null;
  if (typeof tree === "string") {
    const code = rename(tree);
    return code === self ? null : code;
  }
  const [op, children] = "and" in tree ? ["and", tree.and] : ["or", tree.or];
  const mapped = children
    .map((child) => mapTree(child, rename, self))
    .filter((child) => child !== null);
  const unique = [
    ...new Map(mapped.map((child) => [JSON.stringify(child), child])).values(),
  ];
  if (unique.length <= 1) return unique[0] ?? null;
  return op === "and" ? { and: unique } : { or: unique };
}

/** Merges D1/D2, N1/N2 and J1/J2/J3 pages into one logical course and points requirements at it. */
export function mergeCourses(pages: CoursePage[]): Course[] {
  const groups = new Map<string, CoursePage[]>();
  for (const page of pages) {
    const base = PART.exec(page.code)?.[1] ?? page.code;
    groups.set(base, [...(groups.get(base) ?? []), page]);
  }

  const multiTerm = new Set<string>();
  const courses: Course[] = [];
  for (const [code, group] of groups) {
    group.sort(byCode);
    const [first] = group;
    if (!first) continue;
    if (group.length === 1 && first.code === code) {
      courses.push(first);
      continue;
    }
    if (group.some((page) => page.code === code)) {
      throw new Error(`${code} exists both whole and in parts`);
    }
    multiTerm.add(code);
    const credits = group.map((page) => page.credits);
    courses.push({
      ...first,
      code,
      number: code.split(" ")[1] ?? first.number,
      credits: credits.every((value) => value !== null)
        ? credits.reduce((sum, value) => sum + value, 0)
        : null,
      terms: sortTerms(group.flatMap((page) => page.terms)),
      parts: group.map((page) => ({
        code: page.code,
        credits: page.credits,
        terms: page.terms,
      })),
    });
  }

  const rename = (code: string) => {
    const base = PART.exec(code)?.[1];
    return base && multiTerm.has(base) ? base : code;
  };
  return courses
    .map((course) => ({
      ...course,
      prerequisites: course.prerequisites && {
        ...course.prerequisites,
        tree: mapTree(course.prerequisites.tree, rename, course.code),
      },
      corequisites: course.corequisites && {
        ...course.corequisites,
        tree: mapTree(course.corequisites.tree, rename, course.code),
      },
      restrictions: course.restrictions && {
        ...course.restrictions,
        excludes: [...new Set(course.restrictions.excludes.map(rename))]
          .filter((excluded) => excluded !== course.code)
          .sort(),
      },
    }))
    .sort(byCode);
}
