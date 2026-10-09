import type { IndexedCourse } from "../catalogue/search.ts";
import { indexCourses } from "../catalogue/search.ts";
import type { CourseSummary } from "../catalogue/types.ts";
import { COPY } from "../copy.ts";
import type { CourseRecord, Plan, Season } from "../profile/types.ts";
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

export type Prop = "subject" | "level" | "term" | "faculty";
export type Filters = Record<Prop, string[]>;
export const PROPS: Prop[] = ["subject", "level", "term", "faculty"];
export const PROP_LABEL: Record<Prop, string> = {
  subject: "Subject",
  level: "Level",
  term: "Term",
  faculty: "Faculty",
};
export const NO_FILTERS: Filters = {
  subject: [],
  level: [],
  term: [],
  faculty: [],
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

/** The readable faculty name, or null for a placeholder that names none. */
export const facultyName = (name: string | null) =>
  name && !NO_FACULTY.has(name) ? facultyLabel(name) : null;

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

export type ProgramRole = "required" | "complementary" | "minor";

/** The program's required courses, every course a complementary group names, then the minor's courses. Each keeps its first role, and graduate courses (600 and up) are left out. */
export function programCodes(
  program: Program | null,
  minor: Program | null,
  index: readonly IndexedCourse[],
): Map<string, ProgramRole> {
  const codes = new Map<string, ProgramRole>();
  const sources = [
    { groups: program?.groups ?? [], minor: false },
    { groups: minor?.groups ?? [], minor: true },
  ];
  for (const source of sources) {
    for (const group of source.groups) {
      const role: ProgramRole = source.minor
        ? "minor"
        : group.kind === "required"
          ? "required"
          : "complementary";
      const add = (code: string) => {
        if (!codes.has(code)) codes.set(code, role);
      };
      if (group.kind === "required") {
        for (const item of group.courses) {
          for (const code of typeof item === "string" ? [item] : item.oneOf) {
            add(code);
          }
        }
      } else if (namesCourses(group)) {
        for (const { course } of index) {
          if (groupAllows(group, course.code)) add(course.code);
        }
      }
    }
  }
  for (const { course } of index) {
    if (levelRank(course) >= 6 && levelRank(course) < 9)
      codes.delete(course.code);
  }
  return codes;
}

export const subjectOf = (code: string) => code.slice(0, code.indexOf(" "));

const levelRank = (c: { number: string }) =>
  /^[1-7]/.test(c.number) ? Number(c.number.slice(0, 1)) : 9;
const levelOf = (c: { number: string }) =>
  levelRank(c) === 9 ? "Other" : `${levelRank(c)}00`;
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
  }
}

/** "COMP, MATH", "100, 200 and 2 more": the value only, since the chip shows the label. */
export function chipText(prop: Prop, values: string[]): string {
  if (prop === "faculty") {
    return values.length > 1
      ? `${values.length} faculties`
      : facultyLabel(values[0] ?? "");
  }
  return values.length > 3
    ? `${values.slice(0, 2).join(", ")} and ${values.length - 2} more`
    : values.join(", ");
}

export type SortKey = "program" | "code";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "program", label: "Program first" },
  { key: "code", label: "Code A to Z" },
];

const DONE: ReadonlySet<BrowseStatus> = new Set(["completed", "covered"]);
const RANK: Record<ProgramRole, number> = {
  required: 0,
  complementary: 1,
  minor: 2,
};

/**
 * Program first lists the program courses the student can take now (required, then complementary, then the minor's),
 * then the program's subjects, then the rest, each by level then code.
 * In "In my program" the other program courses follow, then the minor's, and finished courses go last. A search keeps its relevance order.
 */
export function sortCourses(
  list: readonly CourseSummary[],
  key: SortKey,
  student: Student & { programSubjects: ReadonlySet<string> },
  view: View,
  searched: boolean,
): CourseSummary[] {
  const byCode = (a: CourseSummary, b: CourseSummary) =>
    a.code < b.code ? -1 : 1;
  if (key === "code") return [...list].sort(byCode);
  if (searched) return [...list];
  const byLevel = (a: CourseSummary, b: CourseSummary) =>
    levelRank(a) - levelRank(b) || byCode(a, b);
  const tier = (course: CourseSummary) => {
    const role = student.inProgram.get(course.code);
    if (view === "program" && DONE.has(statusOf(student.states, course.code))) {
      return 9;
    }
    if (role && student.canTake.has(course.code)) return RANK[role];
    if (view === "program") return role === "minor" ? 4 : 3;
    return student.programSubjects.has(course.subject) ? 3 : 4;
  };
  return list
    .map((course) => ({ course, tier: tier(course) }))
    .sort((a, b) => a.tier - b.tier || byLevel(a.course, b.course))
    .map(({ course }) => course);
}

export type View = "can-take" | "program" | "all";
const VIEW_LABEL: Record<View, string> = {
  "can-take": "Can take now",
  program: "In my program",
  all: "All",
};

/** The views a student has, the default first: All for a visitor, and In my program only with a program. */
export function viewsFor(
  hasProfile: boolean,
  hasProgram: boolean,
): { value: View; label: string }[] {
  const views: View[] = !hasProfile
    ? ["all"]
    : hasProgram
      ? ["can-take", "program", "all"]
      : ["can-take", "all"];
  return views.map((value) => ({ value, label: VIEW_LABEL[value] }));
}

export interface Student {
  states: ReadonlyMap<string, CourseState>;
  inProgram: ReadonlyMap<string, ProgramRole>;
  /** Courses `canTakeNow` accepts, the one definition of "Can take" (D33). */
  canTake: ReadonlySet<string>;
}

export const statusOf = (
  states: Student["states"],
  code: string,
): BrowseStatus => states.get(code)?.status ?? "available";

export function inView(
  view: View,
  course: CourseSummary,
  { inProgram, canTake }: Student,
): boolean {
  switch (view) {
    case "all":
      return true;
    case "can-take":
      return canTake.has(course.code);
    case "program":
      return inProgram.has(course.code);
  }
}

export interface Query {
  view: View;
  q: string;
  filters: Filters;
  sort: SortKey;
  /** One-based. */
  page: number;
}

/** What the page offers: its views, the default first. Sorting needs a program, since without one only one order applies. */
type Offer = readonly { value: View }[];
const sortable = (views: Offer) => views.some((v) => v.value === "program");

const FIXED: Partial<Record<Prop, string[]>> = {
  level: LEVELS,
  term: SEASONS,
};

/** Reads the URL. A view, filter value or sort the page does not offer falls back to the default. */
export function readQuery(params: URLSearchParams, views: Offer): Query {
  const wanted = params.get("view");
  const filters = { ...NO_FILTERS };
  for (const prop of PROPS) {
    const allowed = FIXED[prop];
    filters[prop] = params
      .getAll(prop)
      .filter((value) => !allowed || allowed.includes(value));
  }
  return {
    view:
      views.find((v) => v.value === wanted)?.value ?? views[0]?.value ?? "all",
    q: params.get("q") ?? "",
    filters,
    sort: sortable(views) && params.get("sort") === "code" ? "code" : "program",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1),
  };
}

/** Leaves out every default, so the plain page has a plain URL. */
export function queryString(query: Query, views: Offer): string {
  const params = new URLSearchParams();
  if (query.view !== views[0]?.value) params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  for (const prop of PROPS) {
    for (const value of query.filters[prop]) params.append(prop, value);
  }
  if (query.sort !== "program") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

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
      if (state?.blockedBy.length) return COPY.notOpen(state.blockedBy);
      const tree = course.prerequisites?.tree;
      return tree
        ? COPY.needs(missingText(tree, student.snapshot.taken))
        : "Check the prerequisites on the course page.";
    }
    case "available":
      return "You have every prerequisite.";
    case "planned": {
      const term = student.plan.find((entry) =>
        entry.courses.includes(course.code),
      )?.term;
      return term ? COPY.plannedFor(term) : "Planned.";
    }
    case "in-progress": {
      const pending = student.snapshot.pending.get(course.code);
      return pending
        ? `Part of this course is done. Credit comes when ${course.code}${pending.last} is done.`
        : "You are taking this now.";
    }
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
      const when = record?.term ? ` in ${COPY.term(record.term)}` : "";
      const grade = record?.grade
        ? ` with ${article(record.grade)} ${record.grade}`
        : "";
      return `Completed${when}${grade}.`;
    }
    case "covered":
      return "Your Science DEC covers this course.";
  }
}
