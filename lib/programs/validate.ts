import { logicalCode } from "../profile/types.ts";
import type { Program } from "./types.ts";

export type ValidationResult =
  | { ok: true; program: Program }
  | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

const CODE = /^[A-Z]{4} \d{3}$/;
const PART_CODE = /^[A-Z]{4} \d{3}[DJN]\d$/;
const SUBJECT = /^[A-Z]{4}$/;

const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks a parsed JSON value against the program schema and lists every problem with its path. */
export function validateProgram(value: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (path: string, message: string) => {
    errors.push(`${path}: ${message}`);
  };

  function object(v: unknown, path: string, keys: string[]): Obj | null {
    if (!isObj(v)) {
      fail(path, "expected an object");
      return null;
    }
    for (const key of Object.keys(v)) {
      if (!keys.includes(key)) {
        fail(
          `${path}.${key}`,
          `unknown property, expected one of ${keys.join(", ")}`,
        );
      }
    }
    return v;
  }

  function text(
    o: Obj,
    key: string,
    path: string,
    pattern?: RegExp,
    hint = "",
  ) {
    const v = o[key];
    if (typeof v !== "string" || v.trim() === "") {
      fail(`${path}.${key}`, "expected a non-empty string");
    } else if (pattern && !pattern.test(v)) {
      fail(`${path}.${key}`, `"${v}" is not valid, ${hint}`);
    }
  }

  function optionalText(o: Obj, key: string, path: string) {
    if (o[key] !== undefined) text(o, key, path);
  }

  function num(
    o: Obj,
    key: string,
    path: string,
    kind: "positive" | "count" | "credits" | "level",
  ) {
    const v = o[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      fail(`${path}.${key}`, "expected a number");
    } else if (kind === "positive" && v <= 0) {
      fail(`${path}.${key}`, "expected a number above 0");
    } else if (kind === "credits" && v < 0) {
      fail(`${path}.${key}`, "expected a number of 0 or more");
    } else if (kind === "count" && (!Number.isInteger(v) || v < 1)) {
      fail(`${path}.${key}`, "expected a whole number of 1 or more");
    } else if (kind === "level" && (v < 100 || v % 100 !== 0)) {
      fail(`${path}.${key}`, "expected a hundred-level such as 300");
    }
    return typeof v === "number" ? v : null;
  }

  function optionalNum(
    o: Obj,
    key: string,
    path: string,
    kind: "count" | "credits" | "level",
  ) {
    return o[key] === undefined ? null : num(o, key, path, kind);
  }

  function code(v: unknown, path: string) {
    if (typeof v !== "string") {
      fail(path, "expected a course code such as COMP 202");
    } else if (PART_CODE.test(v)) {
      fail(
        path,
        `"${v}" is one part of a multi-term course, use "${logicalCode(v)}"`,
      );
    } else if (!CODE.test(v)) {
      fail(path, `"${v}" is not a course code like COMP 202`);
    }
  }

  function list(
    v: unknown,
    path: string,
    minLength: number,
    item: (entry: unknown, entryPath: string) => void,
  ) {
    if (!Array.isArray(v) || v.length < minLength) {
      fail(
        path,
        minLength === 1
          ? "expected a non-empty array"
          : `expected an array of at least ${minLength}`,
      );
      return;
    }
    v.forEach((entry, i) => {
      item(entry, `${path}[${i}]`);
    });
  }

  function atMost(
    low: number | null,
    high: number | null,
    path: string,
    lowKey: string,
    highKey: string,
  ) {
    if (low !== null && high !== null && low > high) {
      fail(path, `${lowKey} (${low}) is above ${highKey} (${high})`);
    }
  }

  function match(v: unknown, path: string) {
    const m = object(v, path, ["subjects", "minLevel", "maxLevel", "exclude"]);
    if (!m) return;
    if (
      m.subjects === undefined &&
      m.minLevel === undefined &&
      m.maxLevel === undefined
    ) {
      fail(path, "expected at least one of subjects, minLevel, maxLevel");
    }
    if (m.subjects !== undefined) {
      list(m.subjects, `${path}.subjects`, 1, (s, p) => {
        if (typeof s !== "string" || !SUBJECT.test(s))
          fail(p, "expected a four-letter subject such as COMP");
      });
    }
    if (m.exclude !== undefined) list(m.exclude, `${path}.exclude`, 1, code);
    const low = optionalNum(m, "minLevel", path, "level");
    const high = optionalNum(m, "maxLevel", path, "level");
    atMost(low, high, path, "minLevel", "maxLevel");
  }

  function rule(v: unknown, path: string) {
    const r = object(v, path, [
      "title",
      "minCredits",
      "maxCredits",
      "minCourses",
      "maxCourses",
      "courses",
      "match",
    ]);
    if (!r) return;
    text(r, "title", path);
    if (r.courses === undefined && r.match === undefined) {
      fail(path, "expected courses or match");
    }
    if (r.courses !== undefined) list(r.courses, `${path}.courses`, 1, code);
    if (r.match !== undefined) match(r.match, `${path}.match`);
    atMost(
      optionalNum(r, "minCredits", path, "credits"),
      optionalNum(r, "maxCredits", path, "credits"),
      path,
      "minCredits",
      "maxCredits",
    );
    atMost(
      optionalNum(r, "minCourses", path, "count"),
      optionalNum(r, "maxCourses", path, "count"),
      path,
      "minCourses",
      "maxCourses",
    );
  }

  function item(v: unknown, path: string) {
    if (typeof v === "string") return code(v, path);
    const o = object(v, path, ["oneOf"]);
    if (o) list(o.oneOf, `${path}.oneOf`, 2, code);
  }

  function group(v: unknown, path: string) {
    if (!isObj(v)) return fail(path, "expected an object");
    if (v.kind === "required") {
      const g = object(v, path, [
        "title",
        "kind",
        "credits",
        "courses",
        "note",
      ]);
      if (!g) return;
      text(g, "title", path);
      num(g, "credits", path, "positive");
      optionalText(g, "note", path);
      list(g.courses, `${path}.courses`, 1, item);
    } else if (v.kind === "complementary") {
      const g = object(v, path, [
        "title",
        "kind",
        "credits",
        "minCourses",
        "rules",
        "note",
      ]);
      if (!g) return;
      text(g, "title", path);
      num(g, "credits", path, "positive");
      optionalNum(g, "minCourses", path, "count");
      optionalText(g, "note", path);
      list(g.rules, `${path}.rules`, 1, rule);
    } else {
      fail(`${path}.kind`, 'expected "required" or "complementary"');
    }
  }

  const program = object(value, "program", [
    "id",
    "name",
    "degree",
    "faculty",
    "catalogueYear",
    "source",
    "credits",
    "groups",
  ]);
  if (program) {
    text(
      program,
      "id",
      "program",
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "use lowercase words joined by dashes",
    );
    text(program, "name", "program");
    text(program, "degree", "program");
    text(program, "faculty", "program");
    text(
      program,
      "catalogueYear",
      "program",
      /^\d{4}-\d{4}$/,
      "use a year pair such as 2026-2027",
    );
    text(
      program,
      "source",
      "program",
      /^https:\/\/\S+$/,
      "use the https URL of the program page",
    );
    num(program, "credits", "program", "positive");
    list(program.groups, "program.groups", 1, group);
  }

  return errors.length === 0
    ? { ok: true, program: value as Program }
    : { ok: false, errors };
}
