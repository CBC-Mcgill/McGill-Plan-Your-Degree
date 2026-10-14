import meta from "../data/catalogue/meta.json";
import { creditsLabel, list, WORDS } from "./engine/parts.ts";
import type { Basis } from "./engine/progress.ts";
import { creditsText, sentence } from "./format.ts";
import { termLabel } from "./profile/term-options.ts";
import type { Season, Term } from "./profile/types.ts";
import { isMinor, type Pair } from "./programs/minor.ts";
import type { ProgramSummary } from "./programs/types.ts";

const BASIS: Record<Basis, string> = {
  earned: "earned",
  counting: "earned or in progress",
  plan: "with your plan",
};

/** A minor's "Technological Entrepreneurship Minor" becomes "Technological Entrepreneurship minor", and a minor's name without the word gains it. Any other program keeps its name. */
const secondTitle = ({
  name,
  ...program
}: Pick<ProgramSummary, "id" | "name" | "degree">) =>
  !isMinor(program)
    ? name
    : /\sminor$/i.test(name)
      ? name.replace(/minor$/i, "minor")
      : /\bminor\b/i.test(name)
        ? name
        : `${name} minor`;

/** What each program of a pair is called: `labels` on bars and fields, `nouns` inside sentences, both as [program, second program]. */
const PAIR: Record<
  Pair,
  { labels: [string, string]; nouns: [string, string] }
> = {
  minor: { labels: ["Major", "Minor"], nouns: ["program", "minor"] },
  joint: {
    labels: ["Joint honours", "Joint honours"],
    nouns: ["first component", "second component"],
  },
  majors: {
    labels: ["Major", "Second major"],
    nouns: ["first major", "second major"],
  },
  liberal: {
    labels: ["Core", "Breadth"],
    nouns: ["core", "breadth component"],
  },
  other: {
    labels: ["Program", "Second program"],
    nouns: ["first program", "second program"],
  },
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Major and minor credits", or "Joint honours credits" when both halves share the word. */
const pairCredits = (pair: Pair) => {
  const [first, second] = PAIR[pair].labels;
  return first === second
    ? `${first} credits`
    : `${first} and ${second.toLowerCase()} credits`;
};

/** "Winter 2027 and Fall 2027", the terms a multi-term course spans. One term reads as itself. */
const termPair = (...terms: Term[]) => list.format(terms.map(termLabel));

/** Every string the app repeats across screens, worded once. A string used on one screen stays in its component. */
export const COPY = {
  credits: creditsText,
  rowCredits: creditsLabel,
  fraction: (n: number, total: number) => `${n} of ${total} credits`,
  /** Progress for a program with no credit total, such as a doctorate. */
  requirementsMet: (n: number, total: number) =>
    `${n} of ${total} requirements met`,
  degreeFigure: (n: number, total: number | null) =>
    total === null
      ? `${n} credits earned`
      : `${n} of ${total} degree credits earned`,
  basis: BASIS,
  /** "4 more credits needed. Thesis courses can take up to 33." */
  roomLeft: (
    missing: number,
    ranges: readonly { title: string; max: number }[],
  ) =>
    `${missing} more ${missing === 1 ? "credit" : "credits"} needed. ${list.format(ranges.map(({ title, max }) => `${sentence(title)} can take up to ${max}`))}.`,
  pending: (n: number) => `${creditsText(n)} pending`,
  termsLeft: (n: number, term: Term) =>
    `${n} ${n === 1 ? "term" : "terms"} left, until ${termLabel(term)}`,
  termCredits: creditsText,
  term: termLabel,
  termPair,
  now: "Now",
  plannedFor: (term: Term) => `Planned for ${termLabel(term)}`,
  notOfferedYear: `Not offered in ${meta.catalogueYear}`,
  notOfferedIn: (season: Season) => `Not offered in ${season}`,
  notOffered: "Not offered",
  endsAfter: "Ends after graduation",
  endsAfterGraduation: (terms: number, graduation: Term) =>
    `Takes ${WORDS[terms]} terms, so it ends after your expected graduation in ${termLabel(graduation)}`,
  needs: (text: string) => `Needs ${text} first`,
  notOpen: (codes: readonly string[]) =>
    `Not open to students who have taken ${list.format(codes)}`,
  hasConditions: "Has conditions",
  countsForBoth: "Counts for both",
  checkRequirement: "Check this requirement",
  checkedByYou: "Checked by you",
  markChecked: "Mark as checked",
  markWaived: "Mark as waived",
  waivedByYou: "Waived by you",
  waiverReminder:
    "A waiver you marked still needs its credits replaced. Confirm it with your advisor.",
  addCourse: "Add a course",
  listedCourses: "Courses you listed",
  meetsRequirement: "Do these courses meet the requirement?",
  confirmChecked: "Yes, mark as checked",
  notYet: "Not yet",
  notTaken: "Not taken",
  adviserApproval: "Your advisor must approve these courses",
  pickOne:
    "Complete one of these streams. The one you are furthest along in counts.",
  catalogueLink: "McGill catalogue",
  vsbLink: "Visual Schedule Builder",
  generated: "Read automatically from the catalogue",
  secondTitle,
  pair: PAIR,
  pairCredits,
  capital,
  /** "Program only" on a second program's row whose course counts for the first program alone. */
  firstOnly: (pair: Pair) => `${capital(PAIR[pair].nouns[0])} only`,
  importTranscript: "Import your transcript",
  startWithout: "Start without a transcript",
  restore: "Restore a backup",
  exportBackup: "Export a backup",
  reimport: "Re-import a transcript",
  deleteAll: "Delete all my data",
  pickProgram: "Pick your program",
  privacy: "Your transcript is read in this browser and never uploaded.",
  warnings: (n: number) => `${n} ${n === 1 ? "warning" : "warnings"}`,
  toast: {
    added: (code: string, ...terms: Term[]) =>
      `${code} added to ${termPair(...terms)}`,
    moved: (code: string, ...terms: Term[]) =>
      `${code} moved to ${termPair(...terms)}`,
    removed: (code: string, ...terms: Term[]) =>
      `${code} removed from ${termPair(...terms)}`,
  },
  undo: "Undo",
  advisor: "Advisor preview",
};
