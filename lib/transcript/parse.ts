import type { CourseStatus, Season, Term } from "../profile/types";

export type { CourseStatus, Season, Term };

export interface TranscriptCourse {
  /** Subject, number and optional multi-term suffix, e.g. "COMP 250" or "ECSE 458D1". */
  code: string;
  /** Abbreviated transcript title, for display only. */
  title: string | null;
  /** Null only for credits listed before the first term. */
  term: Term | null;
  credits: number | null;
  grade: string | null;
  remarks: string | null;
  earnedCredits: number | null;
  multiTerm: boolean;
  status: CourseStatus;
}

export interface Transcript {
  degree: string | null;
  programs: string[];
  minors: string[];
  creditsRequired: number | null;
  /** The line under "PREVIOUS EDUCATION", such as "Quebec CEGEP/IB". */
  previousEducation: string | null;
  /** Lump-sum advanced standing credits: each "From:" block's total minus the credits of its listed transfer rows. */
  advancedStanding: number;
  courses: TranscriptCourse[];
  /** Raw text of lines that look like course lines but did not parse. */
  unrecognized: string[];
}

// Sources: McGill transcript key (2014), Minerva unofficial transcript help, coursecatalogue grading regulations.
const GRADES: Record<string, CourseStatus> = {
  A: "completed",
  "A-": "completed",
  "B+": "completed",
  B: "completed",
  "B-": "completed",
  "C+": "completed",
  C: "completed",
  D: "completed",
  P: "completed",
  S: "completed",
  CR: "completed",
  R: "completed",
  KK: "completed",
  CO: "completed",
  EX: "exemption",
  F: "failed",
  FN: "failed",
  J: "failed",
  KF: "failed",
  U: "failed",
  W: "withdrawn",
  WF: "withdrawn",
  WL: "withdrawn",
  "W--": "withdrawn",
  "--": "withdrawn",
  N: "withdrawn",
  K: "deferred",
  KE: "deferred",
  "K*": "deferred",
  L: "deferred",
  LE: "deferred",
  "L*": "deferred",
  NE: "deferred",
  NC: "deferred",
  IC: "deferred",
  IP: "in-progress",
  HH: "in-progress",
  Q: "in-progress",
  NA: "in-progress",
  "&&": "in-progress",
  NR: "in-progress",
};

// Registration status codes show in the first column until the course is graded.
const REGISTRATION: Record<string, CourseStatus> = {
  RW: "in-progress",
  RE: "in-progress",
  RL: "in-progress",
  RI: "in-progress",
  RA: "in-progress",
  RX: "in-progress",
  RR: "in-progress",
  WC: "withdrawn",
  WN: "withdrawn",
  WW: "withdrawn",
};

const MARKERS = [
  /UNOFFICIAL Transcript/,
  /SWFTRAN/,
  /horizon\.mcgill\.ca\/pban1\/bzsktran\.P_Display_Form/,
];
// Browser print header and footer: date and time, page title, page URL, page counter.
const PAGE_CHROME = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/,
  /^UNOFFICIAL Transcript for\b/,
  /bzsktran\.P_Display_Form/,
  /^\d+ ?\/ ?\d+$/,
];
const IDENTITY = /^(Student Name|McGill ID|Permanent Code|Email Address)/;
// Multi-term mark: a Wingdings "²", which Chrome prints as U+F0B2.
const MULTI_TERM = /[²]/g;
const TERM = /^(Fall|Winter|Summer) (\d{4})$/;
const SUBJECT = /^[A-Z]{3}[A-Z0-9]$/;
const NUMBER = /^[0-9X]{3}(?:[A-Z][0-9])?$/;
const CODE = /^[A-Z]{3}[A-Z0-9] [0-9X]{3}(?:[A-Z][0-9])?$/;
const SECTION = /^[A-Z0-9]{3}$/;
const CREDITS = /^\*?\d+(?:\.\d+)?\*?$/;
const TRANSFER_CREDITS = /^(\d+(?:\.\d+)?)$/;
const EXEMPTION = /^EXC$/;
const CLASS_AVERAGE = /^[A-DF][+-]?$/;

const isCredits = (cell: string | undefined) => CREDITS.test(cell ?? "");
const toNumber = (cell: string | undefined) =>
  Number((cell ?? "").replaceAll("*", ""));

/** Parses the visual lines of a Minerva unofficial transcript print, each line split into cells at column gaps. */
export function parseTranscript(lines: string[][]): Transcript | null {
  const text = lines.map((cells) => cells.join(" "));
  const found = MARKERS.filter((m) => text.some((t) => m.test(t)));
  if (found.length < 2) return null;

  // Everything above the course table (identity header, legend, holds) is skipped.
  const start = text.findIndex(
    (t) =>
      /^Subject Number Title\b/.test(t) ||
      t === "PREVIOUS EDUCATION" ||
      TERM.test(t),
  );
  if (start < 0) return null;

  const result: Transcript = {
    degree: null,
    programs: [],
    minors: [],
    creditsRequired: null,
    previousEducation: null,
    advancedStanding: 0,
    courses: [],
    unrecognized: [],
  };
  let term: Term | null = null;
  let block: string[] | null = null;
  let inCredits = false;
  let afterPreviousEducation = false;
  // The open "From: X - N credits" block, so transfer rows listed under it are not counted twice.
  let from: { total: number; listed: number } | null = null;
  const closeFrom = () => {
    if (from) result.advancedStanding += Math.max(0, from.total - from.listed);
    from = null;
  };

  for (const cells of lines.slice(start)) {
    if (cells.some((c) => PAGE_CHROME.some((p) => p.test(c)))) continue;
    if (IDENTITY.test(cells[0] ?? "")) continue;
    const line = cells.join(" ");

    if (afterPreviousEducation) {
      afterPreviousEducation = false;
      if (cells.length === 1 && !/^Credits Required for\b/.test(line)) {
        result.previousEducation = line;
        continue;
      }
    }
    if (line === "PREVIOUS EDUCATION") {
      afterPreviousEducation = true;
      continue;
    }

    const required = /^Credits Required for .+ - (\d+) credits?$/.exec(line);
    if (required) {
      result.creditsRequired = Number(required[1]);
      continue;
    }
    const termMatch = TERM.exec(line);
    if (termMatch) {
      term = { season: termMatch[1] as Season, year: Number(termMatch[2]) };
      block = [];
      inCredits = false;
      continue;
    }
    // A term block opens with degree, load and year, then program and minor lines.
    if (block) {
      if (/^(Full|Part)-time\b/.test(line)) continue;
      if (cells.length === 1 && line !== "Credits/Exemptions") {
        block.push(line);
        continue;
      }
      if (block.length > 0) {
        const [degree = null, ...programs] = block;
        result.degree = degree;
        result.programs = programs.filter((p) => !p.startsWith("Minor"));
        result.minors = programs.filter((p) => p.startsWith("Minor"));
      }
      block = null;
    }

    if (line === "Credits/Exemptions") {
      closeFrom();
      inCredits = true;
      continue;
    }
    if (inCredits && line.startsWith("From:")) {
      closeFrom();
      const total = /^From: .+ - (\d+(?:\.\d+)?) credits?$/.exec(line)?.[1];
      from = { total: Number(total ?? 0), listed: 0 };
      continue;
    }

    const course = parseCourse(cells, term, inCredits);
    if (course === null) {
      inCredits = false;
    } else if (course === "unrecognized") {
      result.unrecognized.push(line);
    } else {
      if (course.status !== "transfer" && course.status !== "exemption") {
        inCredits = false;
      } else if (from && course.status === "transfer") {
        from.listed += course.credits ?? 0;
      }
      result.courses.push(course);
    }
  }
  closeFrom();
  return result;
}

function parseCourse(
  raw: string[],
  term: Term | null,
  inCredits: boolean,
): TranscriptCourse | "unrecognized" | null {
  const hasMark = raw.some((c) => c.search(MULTI_TERM) >= 0);
  const cells = raw
    .map((c) => c.replace(MULTI_TERM, "").trim())
    .filter(Boolean);
  const registration =
    cells[0] && cells[0] in REGISTRATION ? cells.shift() : undefined;
  if (SUBJECT.test(cells[0] ?? "") && NUMBER.test(cells[1] ?? "")) {
    cells.splice(0, 2, `${cells[0]} ${cells[1]}`);
  }
  const [code, ...rest] = cells;
  if (!code || !CODE.test(code)) return registration ? "unrecognized" : null;
  const multiTerm = hasMark || /[A-Z][0-9]$/.test(code);
  const base = { code, term, multiTerm, remarks: null };

  // Course table row: section, title, credits, then grade, remarks, earned credits and class average once graded.
  const [section, title, credits, ...tail] = rest;
  if (SECTION.test(section ?? "") && title && isCredits(credits)) {
    const course = { ...base, title, credits: toNumber(credits) };
    const [grade, ...after] = tail;
    if (grade === undefined) {
      const status = registration && REGISTRATION[registration];
      if (!status) return "unrecognized";
      return { ...course, grade: null, earnedCredits: null, status };
    }
    const status = GRADES[grade];
    if (!status) return "unrecognized";
    let remarks: string | null = null;
    if (!isCredits(after[0]) && isCredits(after[1])) {
      remarks = after.shift() ?? null;
    }
    const earnedCredits = isCredits(after[0]) ? toNumber(after.shift()) : null;
    if (CLASS_AVERAGE.test(after[0] ?? "")) after.shift();
    if (after.length > 0) return "unrecognized";
    return { ...course, grade, remarks, earnedCredits, status };
  }

  // Credits/Exemptions row: code, optional title, then credits or an exemption mark.
  if (!inCredits || registration) return "unrecognized";
  const last = rest.at(-1) ?? "";
  if (EXEMPTION.test(last)) {
    const hasCredits = isCredits(rest.at(-2));
    return {
      ...base,
      title: rest.slice(0, hasCredits ? -2 : -1).join(" ") || null,
      credits: hasCredits ? toNumber(rest.at(-2)) : null,
      grade: null,
      earnedCredits: 0,
      status: "exemption",
    };
  }
  const transfer = TRANSFER_CREDITS.exec(last);
  if (!transfer) return "unrecognized";
  const value = Number(transfer[1]);
  return {
    ...base,
    title: rest.slice(0, -1).join(" ") || null,
    credits: value,
    grade: null,
    earnedCredits: value,
    status: "transfer",
  };
}
