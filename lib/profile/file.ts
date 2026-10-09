import { degreeCredits } from "../engine/credits.ts";
import { getProgram } from "../programs/index.ts";
import {
  COURSE_STATUSES,
  type CourseRecord,
  type Plan,
  type Profile,
  SEASONS,
  type Term,
  termKey,
} from "./types.ts";

export const PROFILE_VERSION = 3;

const FORMAT = "plan-your-degree-profile";
const MAX_FILE_CHARS = 1_000_000;
const MAX_RECORDS = 2000;
const MAX_PLAN_TERMS = 60;
const MAX_TERM_COURSES = 30;
// Loose on purpose, since the catalogue has codes like FIGG MYR1 and HIST 298AA.
const CODE = /^[A-Z0-9]{4} [A-Z0-9]{3,6}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const PROGRAM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Obj = Record<string, unknown>;

class ProfileFileError extends Error {}

function bad(path: string, problem: string): never {
  throw new ProfileFileError(`${path} ${problem}.`);
}

function object(value: unknown, path: string, keys: string[]): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    bad(path, "must be an object");
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) bad(`${path}.${key}`, "is not a known field");
  }
  return value as Obj;
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) bad(path, "must be a list");
  if (value.length > max) bad(path, `can hold at most ${max} entries`);
  return value;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string" || value === "" || value.length > max) {
    bad(path, `must be text of 1 to ${max} characters`);
  }
  return value;
}

function number(value: unknown, path: string, min: number, max: number) {
  if (typeof value !== "number" || !(value >= min && value <= max)) {
    bad(path, `must be a number from ${min} to ${max}`);
  }
  return value;
}

function nullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null ? null : read(value);
}

function code(value: unknown, path: string): string {
  if (typeof value !== "string" || !CODE.test(value)) {
    bad(path, "must be a course code such as COMP 202");
  }
  return value;
}

function term(value: unknown, path: string): Term {
  const o = object(value, path, ["season", "year"]);
  const season = SEASONS.find((s) => s === o.season);
  if (!season) bad(`${path}.season`, `must be one of ${SEASONS.join(", ")}`);
  const year = number(o.year, `${path}.year`, 1950, 2100);
  if (!Number.isInteger(year)) bad(`${path}.year`, "must be a whole year");
  return { season, year };
}

function record(value: unknown, path: string): CourseRecord {
  const o = object(value, path, [
    "code",
    "term",
    "credits",
    "grade",
    "status",
    "source",
  ]);
  const status = COURSE_STATUSES.find((s) => s === o.status);
  if (!status) {
    bad(`${path}.status`, `must be one of ${COURSE_STATUSES.join(", ")}`);
  }
  if (o.source !== "transcript" && o.source !== "manual") {
    bad(`${path}.source`, 'must be "transcript" or "manual"');
  }
  return {
    code: code(o.code, `${path}.code`),
    term: nullable(o.term, (v) => term(v, `${path}.term`)),
    credits: nullable(o.credits, (v) => number(v, `${path}.credits`, 0, 200)),
    grade: nullable(o.grade, (v) => text(v, `${path}.grade`, 10)),
    status,
    source: o.source,
  };
}

function plan(value: unknown, path: string): Plan {
  const result = array(value, path, MAX_PLAN_TERMS).map((entry, i) => {
    const at = `${path}[${i}]`;
    const o = object(entry, at, ["term", "courses"]);
    return {
      term: term(o.term, `${at}.term`),
      courses: array(o.courses, `${at}.courses`, MAX_TERM_COURSES).map((c, j) =>
        code(c, `${at}.courses[${j}]`),
      ),
    };
  });
  const courses = result.flatMap((entry) => entry.courses);
  if (
    new Set(result.map((entry) => termKey(entry.term))).size !== result.length
  ) {
    bad(path, "lists the same term twice");
  }
  if (new Set(courses).size !== courses.length) {
    bad(path, "plans the same course twice");
  }
  return result;
}

function profile(value: unknown): Profile {
  const o = object(value, "profile", [
    "records",
    "programId",
    "entry",
    "advancedStanding",
    "creditsRequired",
    "startTerm",
    "graduationTerm",
    "plan",
    "creditLimit",
    "importedAt",
  ]);
  return {
    records: array(o.records, "profile.records", MAX_RECORDS).map((r, i) =>
      record(r, `profile.records[${i}]`),
    ),
    programId: nullable(o.programId, (v) => {
      const id = text(v, "profile.programId", 100);
      if (!PROGRAM_ID.test(id)) {
        bad("profile.programId", "must be lowercase words joined by dashes");
      }
      return id;
    }),
    entry: nullable(o.entry, (v) => {
      if (v !== "cegep" && v !== "foundation") {
        bad("profile.entry", 'must be "cegep" or "foundation"');
      }
      return v;
    }),
    advancedStanding: number(
      o.advancedStanding,
      "profile.advancedStanding",
      0,
      60,
    ),
    creditsRequired: nullable(o.creditsRequired, (v) =>
      number(v, "profile.creditsRequired", 1, 200),
    ),
    startTerm: nullable(o.startTerm, (v) => term(v, "profile.startTerm")),
    graduationTerm: nullable(o.graduationTerm, (v) =>
      term(v, "profile.graduationTerm"),
    ),
    plan: plan(o.plan, "profile.plan"),
    creditLimit: number(o.creditLimit, "profile.creditLimit", 1, 60),
    importedAt: nullable(o.importedAt, (v) => {
      if (typeof v !== "string" || !ISO_TIME.test(v)) {
        bad(
          "profile.importedAt",
          "must be an ISO time such as 2026-09-01T12:00:00.000Z",
        );
      }
      return v;
    }),
  };
}

/** Version 3 keeps credits required only when the student typed one, so a number that repeats the program's default becomes null. */
function dropDefaultCredits(data: Obj): Obj {
  const program =
    typeof data.programId === "string" ? getProgram(data.programId) : undefined;
  const entry =
    data.entry === "cegep" || data.entry === "foundation" ? data.entry : null;
  return data.creditsRequired === degreeCredits(null, entry, program ?? null)
    ? { ...data, creditsRequired: null }
    : data;
}

/** Brings saved data from an older version up to the current shape. Add one step per version bump. */
export function migrateProfile(data: unknown, version: number): unknown {
  let migrated = data;
  if (version < 2 && typeof migrated === "object" && migrated !== null) {
    migrated = {
      entry: null,
      advancedStanding: 0,
      creditsRequired: null,
      ...migrated,
    };
  }
  if (version < 3 && typeof migrated === "object" && migrated !== null) {
    migrated = dropDefaultCredits(migrated as Obj);
  }
  return migrated;
}

export function exportProfile(state: Profile): string {
  const data: Profile = {
    records: state.records,
    programId: state.programId,
    entry: state.entry,
    advancedStanding: state.advancedStanding,
    creditsRequired: state.creditsRequired,
    startTerm: state.startTerm,
    graduationTerm: state.graduationTerm,
    plan: state.plan,
    creditLimit: state.creditLimit,
    importedAt: state.importedAt,
  };
  return JSON.stringify(
    { format: FORMAT, version: PROFILE_VERSION, profile: data },
    null,
    2,
  );
}

export type ParseResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string };

/** The file is untrusted: every field is checked and anything unexpected is rejected. */
export function parseProfileFile(fileText: string): ParseResult {
  try {
    if (fileText.length > MAX_FILE_CHARS) bad("The file", "is too large");
    let json: unknown;
    try {
      json = JSON.parse(fileText);
    } catch {
      bad("The file", "is not valid JSON");
    }
    const file = object(json, "The file", ["format", "version", "profile"]);
    if (file.format !== FORMAT) {
      bad("The file", "is not a Plan Your Degree profile");
    }
    const version = file.version;
    if (
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      bad("version", "must be a whole number of 1 or more");
    }
    if (version > PROFILE_VERSION) {
      bad("The file", "was saved by a newer version of the app");
    }
    return {
      ok: true,
      profile: profile(migrateProfile(file.profile, version)),
    };
  } catch (error) {
    if (error instanceof ProfileFileError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
