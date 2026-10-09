import type { CoursePart, CourseSummary } from "../catalogue/types.ts";
import {
  type CourseRecord,
  earnsCredit,
  isDone,
  type Season,
  type Term,
  termFromKey,
  termKey,
} from "../profile/types.ts";

/** How many terms each multi-term suffix spans: D and N two, J three. */
const ROUTE_LENGTH: Record<string, number> = { D: 2, N: 2, J: 3 };

/** "A and B", "A, B and C". */
export const list = new Intl.ListFormat("en-GB", {
  style: "long",
  type: "conjunction",
});

const digit = (code: string) => Number(code.slice(-1));
const route = (code: string) => code.slice(-2, -1);

/** The term the next part runs in: the next Fall or Winter, or for J the very next term. */
export function nextPartTerm(letter: string, term: Term): Term {
  const next = termKey(term) + 1;
  const skip = letter !== "J" && termFromKey(next).season === "Summer";
  return termFromKey(skip ? next + 1 : next);
}

/** The routes of a multi-term course with their parts in order, such as D1 then D2 and N1 then N2. */
export function partRoutes(
  course: Pick<CourseSummary, "parts">,
): CoursePart[][] {
  const routes = new Map<string, CoursePart[]>();
  for (const part of course.parts ?? []) {
    routes.set(route(part.code), [
      ...(routes.get(route(part.code)) ?? []),
      part,
    ]);
  }
  return [...routes.values()].map((parts) =>
    parts.sort((a, b) => digit(a.code) - digit(b.code)),
  );
}

/** "6 cr, 2 terms" for a multi-term course and "3 cr" for any other. */
export function creditsLabel(
  course: Pick<CourseSummary, "credits" | "parts">,
): string {
  if (course.credits === null) return "-";
  const terms = partRoutes(course)[0]?.length ?? 0;
  return `${course.credits} cr${terms > 1 ? `, ${terms} terms` : ""}`;
}

const WORDS = ["", "", "two", "three"];

/** The seasons a route's parts run in, or null when the catalogue does not say for every part. */
function seasons(parts: CoursePart[]): Season[] | null {
  const found = parts.map((part) => {
    const set = new Set(part.terms.map((term) => term.split(" ")[0]));
    return set.size === 1 ? ([...set][0] as Season) : null;
  });
  return found.every((season) => season !== null) ? (found as Season[]) : null;
}

/** "Taken over two consecutive terms: ECSE 458D1 in Fall and ECSE 458D2 in Winter, or ...". Null for a course taken in one term. */
export function routesText(
  course: Pick<CourseSummary, "parts">,
): string | null {
  const routes = partRoutes(course).filter((parts) => parts.length > 1);
  if (routes.length === 0) return null;
  const text = routes.map((parts) => {
    const known = seasons(parts);
    const items = parts.map((part, i) => {
      const season = known?.[i];
      if (!season) return part.code;
      return `${part.code} in ${i > 0 && season === "Fall" ? "the following " : ""}${season}`;
    });
    return list.format(items);
  });
  const counts = [...new Set(routes.map((parts) => WORDS[parts.length]))];
  return `Taken over ${counts.join(" or ")} consecutive terms: ${text.join(", or ")}.`;
}

/** The next part a done part needs and has not got. */
export interface OwedPart {
  /** The missing part, such as "D2". */
  part: string;
  /** The part before it, such as "D1". */
  after: string;
  afterTerm: Term;
  /** The next Fall or Winter after `afterTerm`, where the part belongs. */
  due: Term;
}

/** A multi-term course with some parts done and the route unfinished. */
export interface PendingCourse {
  /** Credits of the done parts, which count once the last part is done. */
  credits: number;
  /** The part that finishes the course, such as "D2". */
  last: string;
  owed: OwedPart | null;
}

/** "Credit when ECSE 458D2 is done" for a done part of a course that is not finished. */
export function creditNote(
  record: Pick<CourseRecord, "code" | "part" | "status">,
  pending: ReadonlyMap<string, PendingCourse> | undefined,
): string | undefined {
  const course =
    record.part && isDone(record.status)
      ? pending?.get(record.code)
      : undefined;
  return course && `Credit when ${record.code}${course.last} is done`;
}

type Settled =
  | { finished: true; credits: number | null; earns: boolean }
  | { finished: false; term: Term | null; pending: PendingCourse | null };

/** Reads the part records of each multi-term course. A course counts only when every part of one route is done. */
export function settleParts(
  records: readonly CourseRecord[],
): Map<string, Settled> {
  const byCode = new Map<string, CourseRecord[]>();
  for (const record of records) {
    if (record.part) {
      byCode.set(record.code, [...(byCode.get(record.code) ?? []), record]);
    }
  }
  const settled = new Map<string, Settled>();
  for (const [code, parts] of byCode) {
    const routes = new Map<string, CourseRecord[]>();
    for (const record of parts) {
      const letter = record.part?.[0] ?? "";
      routes.set(letter, [...(routes.get(letter) ?? []), record]);
    }
    let best: { letter: string; done: Map<number, CourseRecord> } | null = null;
    for (const [letter, held] of routes) {
      const done = new Map<number, CourseRecord>();
      for (const record of held) {
        if (isDone(record.status)) done.set(digit(record.part ?? ""), record);
      }
      const length = ROUTE_LENGTH[letter] ?? 0;
      if (length > 0 && done.size >= length) {
        const records = [...done.values()];
        settled.set(code, {
          finished: true,
          earns: records.some((r) => earnsCredit(r.status)),
          credits: records.reduce<number | null>(
            (sum, r) =>
              !earnsCredit(r.status)
                ? sum
                : sum === null || r.credits === null
                  ? null
                  : sum + r.credits,
            0,
          ),
        });
        break;
      }
      if (!best || done.size > best.done.size) best = { letter, done };
    }
    if (settled.has(code)) continue;
    const active = parts.filter(
      (r) => r.status === "in-progress" || isDone(r.status),
    );
    if (active.length === 0 || !best) continue;
    const { letter, done } = best;
    const length = ROUTE_LENGTH[letter] ?? 0;
    const running = new Set(
      parts
        .filter((r) => r.status === "in-progress" && r.part?.startsWith(letter))
        .map((r) => digit(r.part ?? "")),
    );
    let next = 1;
    while (next <= length && (done.has(next) || running.has(next))) next++;
    const anchor = done.get(next - 1);
    const pending: PendingCourse | null =
      done.size === 0
        ? null
        : {
            credits: [...done.values()].reduce(
              (sum, r) => sum + (earnsCredit(r.status) ? (r.credits ?? 0) : 0),
              0,
            ),
            last: `${letter}${length}`,
            owed:
              next > 1 && next <= length && anchor?.term
                ? {
                    part: `${letter}${next}`,
                    after: `${letter}${next - 1}`,
                    afterTerm: anchor.term,
                    due: nextPartTerm(letter, anchor.term),
                  }
                : null,
          };
    const latest = active
      .flatMap((r) => r.term ?? [])
      .sort((a, b) => termKey(b) - termKey(a))[0];
    settled.set(code, { finished: false, term: latest ?? null, pending });
  }
  return settled;
}
