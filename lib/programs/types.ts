/** A required course, or `{ oneOf }` when any single course from the list satisfies it. Codes are logical: ECSE 458, not ECSE 458D1. */
export type RequiredItem = string | { oneOf: string[] };

/** Every item is required. */
export interface RequiredGroup {
  title: string;
  kind: "required";
  /** Credits when every item is taken, as the catalogue heading states. */
  credits: number;
  courses: RequiredItem[];
  note?: string;
  /** Year 0 or Foundation courses that Quebec CEGEP students are credited for. */
  foundation?: true;
}

/** Selects courses by code list, by subject and level, or both. */
export interface Match {
  /** Four-letter subject codes such as COMP. Leave out to match any subject. */
  subjects?: string[];
  /** Lowest hundred-level, so 300 means COMP 300 and up. */
  minLevel?: number;
  /** Highest hundred-level, so 300 means nothing above COMP 399. */
  maxLevel?: number;
  /** Codes that never match, such as the "except COMP 396" in the catalogue text. */
  exclude?: string[];
}

/** One line of a complementary list. `courses` or `match.subjects` add courses to the group, a level-only `match` just filters, as in "at least 6 credits at the 400 level". */
export interface Rule {
  title: string;
  /** At least this many credits must come from the rule. */
  minCredits?: number;
  /** Credits beyond this do not count toward the group. */
  maxCredits?: number;
  minCourses?: number;
  /** Courses beyond this do not count toward the group, which expresses "A and B cannot both be taken". */
  maxCourses?: number;
  courses?: string[];
  match?: Match;
  /** The crawler could not turn this catalogue text into a rule, so it matches no course and `title` holds the text for a person to read. */
  unparsed?: true;
}

/** A course counts once toward the group total but can satisfy several rules in the group. */
export interface ComplementaryGroup {
  title: string;
  kind: "complementary";
  /** Credits needed from the group. A range in the catalogue takes its lower bound. */
  credits: number;
  /** For "9-12 credits (3 courses)" style lines. */
  minCourses?: number;
  rules: Rule[];
  note?: string;
  /** Year 0 or Foundation courses that Quebec CEGEP students are credited for. */
  foundation?: true;
}

export type Group = RequiredGroup | ComplementaryGroup;

export interface Program {
  /** Lowercase words joined by dashes, such as computer-science-major-bsc. */
  id: string;
  name: string;
  /** B.Sc. or B.Eng. */
  degree: string;
  faculty: string;
  /** The catalogue year the page was read from, such as 2026-2027. */
  catalogueYear: string;
  /** The program page the file was checked against. */
  source: string;
  /** Total program credits, the lower bound when the page gives a range. */
  credits: number;
  groups: Group[];
  /** Written by the program crawler rather than by hand. */
  generated?: true;
}
