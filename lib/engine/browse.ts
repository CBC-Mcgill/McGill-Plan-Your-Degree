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
  /** Options with the same group sit under one heading. */
  group?: string;
}

/** The catalogue abbreviates faculty names. These are the readable ones. */
const FACULTY_LABEL: Record<string, string> = {
  "Desautels Faculty Management": "Desautels Faculty of Management",
  "Fac Dental Medicine & Oral HS":
    "Faculty of Dental Medicine and Oral Health Sciences",
  "Faculty of Agric Environ Sci":
    "Faculty of Agricultural and Environmental Sciences",
  "Faculty of Medicine & Hlth Sci": "Faculty of Medicine and Health Sciences",
  "Interfaculty, B.A. & Sc.": "Interfaculty, B.A. and Sc.",
  "Post Graduate Dentistry": "Postgraduate Dentistry",
  "Post Graduate Medicine": "Postgraduate Medicine",
  "School of Phys & Occ Therapy": "School of Physical and Occupational Therapy",
};
/** Catalogue placeholders that name no faculty. */
const NO_FACULTY = new Set(["No College Designated", "Not used in standing"]);
const facultyLabel = (name: string) => FACULTY_LABEL[name] ?? name;

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
    if (course.faculty && !NO_FACULTY.has(course.faculty)) {
      faculties.add(course.faculty);
    }
  }
  const subjects = [...departments]
    .map(([subject, byDepartment]): Option => {
      const [name] = [...byDepartment].sort((a, b) => b[1] - a[1])[0] ?? [];
      return { value: subject, label: subject, hint: name };
    })
    .sort((a, b) => (a.value < b.value ? -1 : 1));
  return {
    index,
    subjects,
    faculties: [...faculties].sort((a, b) =>
      facultyLabel(a).localeCompare(facultyLabel(b)),
    ),
  };
}

/** The student's own subjects first, each group still in code order. */
export function pinSubjects(
  subjects: Option[],
  pinned: ReadonlySet<string>,
): Option[] {
  if (pinned.size === 0) return subjects;
  const group = (own: boolean) =>
    subjects
      .filter((option) => pinned.has(option.value) === own)
      .map((option) => ({
        ...option,
        group: own ? "Your program" : "Other subjects",
      }));
  return [...group(true), ...group(false)];
}

export type ProgramRole = "required" | "complementary";

/** The program's required courses plus every course a complementary group names. A course in both counts as required. */
export function programCodes(
  program: Program | undefined,
  index: readonly IndexedCourse[],
): Map<string, ProgramRole> {
  const codes = new Map<string, ProgramRole>();
  for (const group of program?.groups ?? []) {
    if (group.kind === "required") {
      for (const item of group.courses) {
        for (const code of typeof item === "string" ? [item] : item.oneOf) {
          codes.set(code, "required");
        }
      }
    } else if (namesCourses(group)) {
      for (const { course } of index) {
        if (groupAllows(group, course.code) && !codes.has(course.code)) {
          codes.set(course.code, "complementary");
        }
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
      return base.faculties.map((value) => ({
        value,
        label: facultyLabel(value),
      }));
    case "credits":
      return Object.entries(CREDIT_LABELS).map(([value, label]) => ({
        value,
        label,
      }));
  }
}

/** "COMP, MATH", "Level 100, 200 and 2 more": the value only, for a set chip. */
export function chipText(prop: Prop, values: string[]): string {
  if (prop === "faculty") {
    return values.length > 1
      ? `${values.length} faculties`
      : facultyLabel(values[0] ?? "");
  }
  const labels = values.map((value) =>
    prop === "credits" ? (CREDIT_LABELS[value] ?? value) : value,
  );
  const text =
    labels.length > 3
      ? `${labels.slice(0, 2).join(", ")} and ${labels.length - 2} more`
      : labels.join(", ");
  if (prop === "level") return `Level ${text}`;
  if (prop === "credits") return `Credits ${text}`;
  return text;
}

export type SortKey = "recommended" | "code" | "level" | "credits";

const DONE: ReadonlySet<BrowseStatus> = new Set(["completed", "covered"]);

/**
 * Recommended lists program courses the student can take now (required before complementary),
 * then the program's subjects, then the rest, each by level then code.
 * In "In my program" finished courses go last. A search keeps its relevance order.
 */
export function sortCourses(
  list: readonly CourseSummary[],
  key: SortKey,
  student: Student & { programSubjects: ReadonlySet<string> },
  view: View,
  searched: boolean,
): CourseSummary[] {
  if (key === "recommended" && searched) return [...list];
  const byCode = (a: CourseSummary, b: CourseSummary) =>
    a.code < b.code ? -1 : 1;
  const byLevel = (a: CourseSummary, b: CourseSummary) =>
    levelRank(a) - levelRank(b) || byCode(a, b);
  if (key === "code") return [...list].sort(byCode);
  if (key === "level") return [...list].sort(byLevel);
  if (key === "credits") {
    return [...list].sort(
      (a, b) => (b.credits ?? 0) - (a.credits ?? 0) || byCode(a, b),
    );
  }
  const tier = (course: CourseSummary) => {
    const status = statusOf(student.states, course.code);
    if (view === "program" && DONE.has(status)) return 4;
    const role = student.inProgram.get(course.code);
    if (role && status === "available" && offeredIn(course).length > 0) {
      return role === "required" ? 0 : 1;
    }
    return student.programSubjects.has(course.subject) ? 2 : 3;
  };
  return list
    .map((course) => ({ course, tier: tier(course) }))
    .sort((a, b) => a.tier - b.tier || byLevel(a.course, b.course))
    .map(({ course }) => course);
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
  inProgram: ReadonlyMap<string, ProgramRole>;
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
      return status === "completed";
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
  const wanted = params.get("view");
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
