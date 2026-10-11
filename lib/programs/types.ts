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

/** Selects courses by subject and level. An empty match is any course, as in "42 credits of Free Electives". */
export interface Match {
  /** Four-letter subject codes such as COMP. Leave out to match any subject. */
  subjects?: string[];
  /** Subjects that never match, as in "6 credits of Non-Music Electives". */
  excludeSubjects?: string[];
  /** Lowest hundred-level, so 300 means COMP 300 and up. */
  minLevel?: number;
  /** Highest hundred-level, so 300 means nothing above COMP 399. */
  maxLevel?: number;
  /** Codes that never match, such as the "except COMP 396" in the catalogue text. */
  exclude?: string[];
}

/** One line of a complementary list. `courses` or `match.subjects` add courses to the group, a level-only `match` or a `filter` rule just filters, as in "at least 6 credits at the 400 level", and a spread rule without `courses` only filters too. A plain `match` with no subjects or level, on a rule that is neither an adviser nor a spread rule, opens the group to any course, as in "42 credits of Free Electives". */
export interface Rule {
  title: string;
  /** At least this many credits must come from the rule. */
  minCredits?: number;
  /** Credits beyond this do not count toward the group. Equal to `minCredits`, or above it by less than the course being counted, it only records the catalogue's amount, as in "9 credits from" or "3-4 credits of", and does not cap, so a 4-credit course may overshoot. */
  maxCredits?: number;
  minCourses?: number;
  /** Courses beyond this do not count toward the group, which expresses "A and B cannot both be taken". */
  maxCourses?: number;
  courses?: string[];
  match?: Match;
  /** The crawler could not turn this catalogue text into a rule, so it matches no course and `title` holds the text for a person to read. */
  unparsed?: true;
  /** The student's adviser must approve the choice, so the app counts what it can and shows a reminder. */
  adviser?: true;
  /** At most this many credits from any one subject count toward the rule, as in "no more than 9 credits from any one discipline". */
  maxCreditsPerSubject?: number;
  /** The rule's courses must span at least this many subjects, as in "drawn from at least 3 disciplines". */
  minSubjects?: number;
  /** The rule narrows the group's courses by subject and level and adds none, like a level-only filter, as in "at least 12 credits must be from COMP courses at the 500 level" over a group's lists. */
  filter?: true;
  /** The stream the rule belongs to, in a group where the student completes one of several streams, as in "27 credits from one of the following two streams". A rule without one applies to every stream. */
  option?: string;
}

/** A course counts once toward the group total but can satisfy several rules in the group. When rules name an `option`, each option is counted with the shared rules as if it were the whole group, and the option furthest along stands for the group. */
export interface ComplementaryGroup {
  title: string;
  kind: "complementary";
  /** Credits needed from the group. A range in the catalogue takes its lower bound. 0 for a group whose rules are all unparsed and hold a condition over the whole program, such as "a maximum of 34 credits at the 200 level", so a person checks it and no credits move. */
  credits: number;
  /** For "9-12 credits (3 courses)" style lines. */
  minCourses?: number;
  /** The older form of one rule per stream, the same as giving each rule an `option` of its own. Files written before `option` still use it. */
  pickOne?: true;
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
  /** Minors: the most credits that may also count toward the student's program, as the minor's page states. 0 when none may. */
  overlap?: number;
  /** Written by the program crawler rather than by hand. */
  generated?: true;
}

/** One line of the program list: enough to search and to show, without the requirements. */
export type ProgramSummary = Pick<
  Program,
  "id" | "name" | "degree" | "faculty"
>;
