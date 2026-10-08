import type { IndexedCourse } from "../catalogue/search.ts";
import { indexCourses } from "../catalogue/search.ts";
import type { CourseSummary } from "../catalogue/types.ts";
import { formatTerm } from "../profile/terms.ts";
import type { CourseRecord, Plan, Season, Term } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { groupAllows, namesCourses } from "./progress.ts";
import type { Snapshot } from "./snapshot.ts";
import {
  type BrowseStatus,
  type CourseState,
  isOffered,
  missingText,
} from "./status.ts";

export const SEASONS: Season[] = ["Fall", "Winter", "Summer"];
const LEVELS = ["100", "200", "300", "400", "500", "600", "700"];
const CREDIT_LABELS: Record<string, string> = {
  "1": "1 or fewer",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5 or more",
};

export type Prop = "subject" | "level" | "term" | "faculty" | "credits";
export type Filters = Record<Prop, string[]>;
export const PROPS: Prop[] = ["subject", "level", "term", "faculty", "credits"];
export const PROP_LABEL: Record<Prop, string> = {
  subject: "Subject",
  level: "Level",
  term: "Term",
  faculty: "Faculty",
  credits: "Credits",
};
export const NO_FILTERS: Filters = {
  subject: [],
  level: [],
  term: [],
  faculty: [],
  credits: [],
};

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

/** Everything that depends only on the catalogue, so a status change never rebuilds it. */
export interface CatalogueBase {
  index: IndexedCourse[];
  subjects: Option[];
  faculties: string[];
}

export function buildBase(courses: Iterable<CourseSummary>): CatalogueBase {
  const index = indexCourses(courses);
  const departments = new Map<string, Map<string, number>>();
  const faculties = new Set<string>();
  for (const { course } of index) {
    const byDepartment =
      departments.get(course.subject) ?? new Map<string, number>();
    if (course.offeredBy) {
      byDepartment.set(
        course.offeredBy,
        (byDepartment.get(course.offeredBy) ?? 0) + 1,
      );
    }
    departments.set(course.subject, byDepartment);
    if (course.faculty) faculties.add(course.faculty);
  }
  const subjects = [...departments]
    .map(([subject, byDepartment]): Option => {
      const [name] = [...byDepartment].sort((a, b) => b[1] - a[1])[0] ?? [];
      return { value: subject, label: subject, hint: name };
    })
    .sort((a, b) => (a.value < b.value ? -1 : 1));
  return { index, subjects, faculties: [...faculties].sort() };
}

/** The program's required courses plus every course a complementary group names. */
export function programCodes(
  program: Program | undefined,
  index: readonly IndexedCourse[],
): Set<string> {
  const codes = new Set<string>();
  for (const group of program?.groups ?? []) {
    if (group.kind === "required") {
      for (const item of group.courses) {
        for (const code of typeof item === "string" ? [item] : item.oneOf) {
          codes.add(code);
        }
      }
    } else if (namesCourses(group)) {
      for (const { course } of index) {
        if (groupAllows(group, course.code)) codes.add(course.code);
      }
    }
  }
  return codes;
}

export const subjectOf = (code: string) => code.slice(0, code.indexOf(" "));

const levelRank = (c: { number: string }) =>
  /^[1-7]/.test(c.number) ? Number(c.number.slice(0, 1)) : 9;
const levelOf = (c: { number: string }) =>
  levelRank(c) === 9 ? "Other" : `${levelRank(c)}00`;
const creditBucket = (credits: number) =>
  String(Math.min(5, Math.max(1, Math.round(credits))));
const offeredIn = (c: CourseSummary) =>
  SEASONS.filter((season) => isOffered(c, season));

function valuesOf(c: CourseSummary, prop: Prop): string[] {
  switch (prop) {
    case "subject":
      return [c.subject];
    case "level":
      return [levelOf(c)];
    case "term":
      return offeredIn(c);
    case "faculty":
      return c.faculty ? [c.faculty] : [];
    case "credits":
      return c.credits === null ? [] : [creditBucket(c.credits)];
  }
}

/** True when the course matches every set filter: one of the chosen values for each property. */
export function passes(c: CourseSummary, filters: Filters): boolean {
  return PROPS.every(
    (prop) =>
      filters[prop].length === 0 ||
      valuesOf(c, prop).some((value) => filters[prop].includes(value)),
  );
}

export function optionsOf(prop: Prop, base: CatalogueBase): Option[] {
  switch (prop) {
    case "subject":
      return base.subjects;
    case "level":
      return LEVELS.map((value) => ({ value, label: value }));
    case "term":
      return SEASONS.map((value) => ({ value, label: value }));
    case "faculty":
      return base.faculties.map((value) => ({ value, label: value }));
    case "credits":
      return Object.entries(CREDIT_LABELS).map(([value, label]) => ({
        value,
        label,
      }));
  }
}

/** "COMP", "COMP, MATH" or "COMP, MATH +2": the value only, for a set chip. */
export function chipText(prop: Prop, values: string[]): string {
  if (prop === "faculty" && values.length > 1) {
    return `${values.length} faculties`;
  }
  const labels = values.map((value) =>
    prop === "credits" ? (CREDIT_LABELS[value] ?? value) : value,
  );
  const shown = labels.slice(0, 2).join(", ");
  const text = labels.length > 2 ? `${shown} +${labels.length - 2}` : shown;
  if (prop === "level") return `${text} level`;
  if (prop === "credits") return `${text} credits`;
  return text;
}

export type SortKey = "recommended" | "code" | "level" | "credits";

/** Recommended lists the student's program subjects first, then level, then code. A search keeps its relevance order. */
export function sortCourses(
  list: readonly CourseSummary[],
  key: SortKey,
  programSubjects: ReadonlySet<string>,
  searched: boolean,
): CourseSummary[] {
  if (key === "recommended" && searched) return [...list];
  const byCode = (a: CourseSummary, b: CourseSummary) =>
    a.code < b.code ? -1 : 1;
  const mine = (c: CourseSummary) =>
    key === "recommended" && programSubjects.has(c.subject) ? 0 : 1;
  return [...list].sort((a, b) => {
    if (key === "code") return byCode(a, b);
    if (key === "credits") {
      return (b.credits ?? 0) - (a.credits ?? 0) || byCode(a, b);
    }
    return mine(a) - mine(b) || levelRank(a) - levelRank(b) || byCode(a, b);
  });
}

export type View = "all" | "can-take" | "program" | "planned" | "completed";
export const VIEWS: { value: View; label: string }[] = [
  { value: "all", label: "All" },
  { value: "can-take", label: "Can take now" },
  { value: "program", label: "In my program" },
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
];

export interface Student {
  states: ReadonlyMap<string, CourseState>;
  inProgram: ReadonlySet<string>;
}

export const statusOf = (
  states: Student["states"],
  code: string,
): BrowseStatus => states.get(code)?.status ?? "available";

export function inView(
  view: View,
  course: CourseSummary,
  { states, inProgram }: Student,
): boolean {
  const status = statusOf(states, course.code);
  switch (view) {
    case "all":
      return true;
    // Open to the student, offered this year, and undergraduate.
    case "can-take":
      return (
        status === "available" &&
        offeredIn(course).length > 0 &&
        levelRank(course) < 5
      );
    case "program":
      return inProgram.has(course.code);
    case "planned":
      return status === "planned";
    case "completed":
      return status === "completed" || status === "covered";
  }
}

export function viewCounts(
  index: readonly IndexedCourse[],
  student: Student,
): Record<View, number> {
  const counts: Record<View, number> = {
    all: 0,
    "can-take": 0,
    program: 0,
    planned: 0,
    completed: 0,
  };
  for (const { course } of index) {
    for (const { value } of VIEWS) {
      if (inView(value, course, student)) counts[value]++;
    }
  }
  return counts;
}

export interface Query {
  view: View;
  q: string;
  filters: Filters;
  sort: SortKey;
  /** One-based. */
  page: number;
}

export const defaultView = (hasProfile: boolean): View =>
  hasProfile ? "can-take" : "all";

const FIXED: Partial<Record<Prop, string[]>> = {
  level: LEVELS,
  term: SEASONS,
  credits: Object.keys(CREDIT_LABELS),
};
const SORT_KEYS: SortKey[] = ["recommended", "code", "level", "credits"];

/** Reads the URL. Without a profile the student-only views fall back to All. */
export function readQuery(params: URLSearchParams, hasProfile: boolean): Query {
  // The home page links here with status=available, so keep reading it.
  const wanted =
    params.get("view") ??
    (params.get("status") === "available" ? "can-take" : null);
  const filters = { ...NO_FILTERS };
  for (const prop of PROPS) {
    const allowed = FIXED[prop];
    filters[prop] = params
      .getAll(prop)
      .filter((value) => !allowed || allowed.includes(value));
  }
  return {
    view: hasProfile
      ? (VIEWS.find((v) => v.value === wanted)?.value ?? defaultView(true))
      : "all",
    q: params.get("q") ?? "",
    filters,
    sort: SORT_KEYS.find((key) => key === params.get("sort")) ?? "recommended",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1),
  };
}

/** Leaves out every default, so the plain page has a plain URL. */
export function queryString(query: Query, hasProfile: boolean): string {
  const params = new URLSearchParams();
  if (query.view !== defaultView(hasProfile)) params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  for (const prop of PROPS) {
    for (const value of query.filters[prop]) params.append(prop, value);
  }
  if (query.sort !== "recommended") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const article = (grade: string) =>
  /^[AEFHILMNORSX]/i.test(grade) ? "an" : "a";

/** The one sentence that says why a course has its status. */
export function statusDetail(
  course: CourseSummary,
  state: CourseState | undefined,
  student: { snapshot: Snapshot; records: CourseRecord[]; plan: Plan },
): string {
  switch (state?.status ?? "available") {
    case "locked": {
      if (state?.blockedBy.length) {
        return `Not open to students who have taken ${list.format(state.blockedBy)}.`;
      }
      const tree = course.prerequisites?.tree;
      return tree
        ? `Needs ${missingText(tree, student.snapshot.taken)} first.`
        : "Check the prerequisites on the course page.";
    }
    case "available":
      return "You have every prerequisite.";
    case "planned": {
      const term: Term | undefined = student.plan.find((entry) =>
        entry.courses.includes(course.code),
      )?.term;
      return term ? `Planned for ${formatTerm(term)}.` : "Planned.";
    }
    case "in-progress":
      return "You are taking this now.";
    case "completed": {
      const record = student.records.find(
        (r) =>
          r.code === course.code &&
          (r.status === "completed" ||
            r.status === "transfer" ||
            r.status === "exemption"),
      );
      if (record?.status === "transfer") return "Counted as transfer credit.";
      if (record?.status === "exemption") {
        return "You are exempt from this course.";
      }
      const when = record?.term ? ` in ${formatTerm(record.term)}` : "";
      const grade = record?.grade
        ? ` with ${article(record.grade)} ${record.grade}`
        : "";
      return `Completed${when}${grade}.`;
    }
    case "covered":
      return "Your Science DEC covers this course.";
  }
}
