import type { CourseSummary } from "./types.ts";

export interface IndexedCourse {
  course: CourseSummary;
  /** Lowercase code without the space, so "comp251", "COMP 251" and "comp 251" all compare equal. */
  key: string;
  title: string;
}

/** Built once per catalogue so a keystroke only scans short strings. Sorted by code. */
export function indexCourses(
  courses: Iterable<CourseSummary>,
): IndexedCourse[] {
  return [...courses]
    .sort((a, b) => (a.code < b.code ? -1 : 1))
    .map((course) => ({
      course,
      key: course.code.replace(" ", "").toLowerCase(),
      title: course.title.toLowerCase(),
    }));
}

/** Exact code first, then code prefix, then title, then a code that merely contains the query. Code order within each group. */
export function searchCourses(
  index: readonly IndexedCourse[],
  query: string,
): CourseSummary[] {
  const text = query.trim().toLowerCase();
  const compact = text.replace(/\s+/g, "");
  if (!compact) return index.map((entry) => entry.course);
  const words = text.split(/\s+/);
  const exact: CourseSummary[] = [];
  const prefix: CourseSummary[] = [];
  const titled: CourseSummary[] = [];
  const contains: CourseSummary[] = [];
  for (const { course, key, title } of index) {
    if (key === compact) exact.push(course);
    else if (key.startsWith(compact)) prefix.push(course);
    else if (words.every((word) => title.includes(word))) titled.push(course);
    else if (key.includes(compact)) contains.push(course);
  }
  return [...exact, ...prefix, ...titled, ...contains];
}
