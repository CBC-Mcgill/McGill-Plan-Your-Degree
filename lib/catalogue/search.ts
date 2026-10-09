import type { CourseSummary } from "./types.ts";

export interface IndexedCourse {
  course: CourseSummary;
  /** Lowercase code without the space, so "comp251", "COMP 251" and "comp 251" all compare equal. */
  key: string;
  title: string;
  /** The title's lowercase words, for whole-word matches. */
  words: Set<string>;
}

/** Built once per catalogue so a keystroke only scans short strings. Sorted by code. */
export function indexCourses(
  courses: Iterable<CourseSummary>,
): IndexedCourse[] {
  return [...courses]
    .sort((a, b) => (a.code < b.code ? -1 : 1))
    .map((course) => {
      const title = course.title.toLowerCase();
      return {
        course,
        key: course.code.replace(" ", "").toLowerCase(),
        title,
        words: new Set(title.split(/[^\p{L}\p{N}]+/u)),
      };
    });
}

/** Exact code, code prefix, title starts with the query, whole-word title match, other title match, then a code that merely contains it. Code order within each group. */
export function searchCourses(
  index: readonly IndexedCourse[],
  query: string,
): CourseSummary[] {
  const text = query.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = text.replace(/ /g, "");
  if (!compact) return index.map((entry) => entry.course);
  const words = text.split(" ");
  const groups: CourseSummary[][] = [[], [], [], [], [], []];
  for (const { course, key, title, words: titleWords } of index) {
    const rank =
      key === compact
        ? 0
        : key.startsWith(compact)
          ? 1
          : title.startsWith(text)
            ? 2
            : words.every((word) => titleWords.has(word))
              ? 3
              : words.every((word) => title.includes(word))
                ? 4
                : key.includes(compact)
                  ? 5
                  : -1;
    if (rank >= 0) groups[rank]?.push(course);
  }
  return groups.flat();
}
