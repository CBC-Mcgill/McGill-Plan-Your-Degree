export type Season = "Fall" | "Winter" | "Summer";

/** Winter 2027 is year 2027. */
export interface Term {
  season: Season;
  year: number;
}

export const COURSE_STATUSES = [
  "completed",
  "in-progress",
  "failed",
  "withdrawn",
  "deferred",
  "transfer",
  "exemption",
] as const;

export type CourseStatus = (typeof COURSE_STATUSES)[number];

export interface CourseRecord {
  /** Logical catalogue code: ECSE 458D1 on a transcript becomes ECSE 458. */
  code: string;
  term: Term | null;
  credits: number | null;
  grade: string | null;
  status: CourseStatus;
  source: "transcript" | "manual";
}

export interface PlannedTerm {
  term: Term;
  courses: string[];
}

export type Plan = PlannedTerm[];

/** How the student started at McGill: a Quebec CEGEP diploma (DEC) in U1, or the U0 Foundation year. */
export type EntryRoute = "cegep" | "foundation";

/** True when the transcript's previous education line names a Quebec CEGEP, such as "Quebec CEGEP/IB". */
export const isCegep = (previousEducation: string | null) =>
  /cegep/i.test(previousEducation ?? "");

/** Everything a student keeps locally. */
export interface Profile {
  records: CourseRecord[];
  programId: string | null;
  entry: EntryRoute | null;
  /** Lump-sum credits from the transcript's advanced standing, on top of the course records. 0 to 60. */
  advancedStanding: number;
  /** Total credits the degree needs, when the student or the transcript says. */
  creditsRequired: number | null;
  startTerm: Term | null;
  graduationTerm: Term | null;
  plan: Plan;
  /** Credits per term before the planner warns. */
  creditLimit: number;
  /** ISO time of the last transcript import. */
  importedAt: string | null;
}

const SEASON_ORDER: Record<Season, number> = { Winter: 0, Summer: 1, Fall: 2 };
export const SEASONS: Season[] = ["Winter", "Summer", "Fall"];

/** Strips the multi-term suffix: ECSE 458D1, ECSE 458N2 and COMP 361D1 become ECSE 458, ECSE 458 and COMP 361. */
export function logicalCode(code: string): string {
  return code.replace(/^(.+ \d{3})[DJN]\d$/, "$1");
}

/** A number that sorts terms chronologically: Winter, Summer, Fall within a year. */
export function termKey(term: Term): number {
  return term.year * 3 + SEASON_ORDER[term.season];
}

export function compareTerms(a: Term, b: Term): number {
  return termKey(a) - termKey(b);
}

export function termFromKey(key: number): Term {
  return {
    season: SEASONS[key % 3] ?? "Winter",
    year: Math.floor(key / 3),
  };
}

/** Done means it counts for prerequisites: completed, transfer, or exemption. */
export function isDone(status: CourseStatus): boolean {
  return (
    status === "completed" || status === "transfer" || status === "exemption"
  );
}

/** An exemption is done but gives no credit. */
export function earnsCredit(status: CourseStatus): boolean {
  return status === "completed" || status === "transfer";
}
