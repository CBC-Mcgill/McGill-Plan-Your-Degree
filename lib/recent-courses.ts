const KEY = "plan-your-degree:recent-courses";
const LIMIT = 5;

/** Codes of the course pages the student opened lately, newest first. Empty when storage is blocked. */
export function recentCourses(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((code) => typeof code === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberCourse(code: string) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(
        [code, ...recentCourses().filter((c) => c !== code)].slice(0, LIMIT),
      ),
    );
  } catch {
    // Blocked or full storage, so the palette simply shows no recent courses.
  }
}

export function forgetRecentCourses() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Blocked storage holds nothing to forget.
  }
}
