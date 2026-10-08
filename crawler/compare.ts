import type { Course } from "../lib/catalogue/types.ts";

const MAX_COUNT_DROP = 0.02;
const MAX_FIELD_LOSS = 0.01;
const REQUIRED_FIELDS = [
  "title",
  "credits",
  "offeredBy",
  "description",
] as const satisfies (keyof Course)[];

const present = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

/** Fails the run when the new crawl looks broken compared to the committed data. */
export function checkGuardrails(previous: Course[], next: Course[]) {
  if (previous.length === 0) return;
  const drop = (previous.length - next.length) / previous.length;
  if (drop > MAX_COUNT_DROP) {
    throw new Error(
      `Course count dropped from ${previous.length} to ${next.length}, more than ${MAX_COUNT_DROP * 100}%`,
    );
  }
  const nextByCode = new Map(next.map((course) => [course.code, course]));
  const lost = previous.filter((old) => {
    const current = nextByCode.get(old.code);
    return (
      current &&
      REQUIRED_FIELDS.some(
        (field) => present(old[field]) && !present(current[field]),
      )
    );
  });
  if (lost.length / previous.length > MAX_FIELD_LOSS) {
    throw new Error(
      `${lost.length} courses lost a required field, more than ${MAX_FIELD_LOSS * 100}%. First few: ${lost
        .slice(0, 5)
        .map((course) => course.code)
        .join(", ")}`,
    );
  }
}

const list = (codes: string[]) =>
  codes.length > 20
    ? `${codes.slice(0, 20).join(", ")} and ${codes.length - 20} more`
    : codes.join(", ");

/** A Markdown summary of added, removed, and changed courses for the data PR. */
export function summarize(previous: Course[], next: Course[]): string {
  const before = new Map(previous.map((course) => [course.code, course]));
  const after = new Map(next.map((course) => [course.code, course]));
  const added = [...after.keys()].filter((code) => !before.has(code));
  const removed = [...before.keys()].filter((code) => !after.has(code));
  const changed = [...after.keys()].filter(
    (code) =>
      before.has(code) &&
      JSON.stringify(before.get(code)) !== JSON.stringify(after.get(code)),
  );
  const unparsed = next.filter(
    (course) => course.prerequisites?.unparsed,
  ).length;
  const withPrereqs = next.filter((course) => course.prerequisites).length;
  return [
    "## Catalogue crawl",
    "",
    `- Courses: ${next.length} (was ${previous.length})`,
    `- Added: ${added.length}${added.length ? ` (${list(added)})` : ""}`,
    `- Removed: ${removed.length}${removed.length ? ` (${list(removed)})` : ""}`,
    `- Changed: ${changed.length}${changed.length ? ` (${list(changed)})` : ""}`,
    `- Prerequisites shown as raw text only: ${unparsed} of ${withPrereqs}`,
    "",
  ].join("\n");
}
