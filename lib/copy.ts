import meta from "../data/catalogue/meta.json";
import { creditsLabel, list } from "./engine/parts.ts";
import type { Basis } from "./engine/progress.ts";
import { creditsText } from "./format.ts";
import { termLabel } from "./profile/term-options.ts";
import type { Season, Term } from "./profile/types.ts";

const BASIS: Record<Basis, string> = {
  earned: "earned",
  counting: "earned or in progress",
  plan: "with your plan",
};

/** "Technological Entrepreneurship Minor" becomes "Technological Entrepreneurship minor", and a name without the word gains it. */
const minorTitle = (name: string) =>
  /\sminor$/i.test(name)
    ? name.replace(/minor$/i, "minor")
    : /\bminor\b/i.test(name)
      ? name
      : `${name} minor`;

/** "Winter 2027 and Fall 2027", the terms a multi-term course spans. One term reads as itself. */
const termPair = (...terms: Term[]) => list.format(terms.map(termLabel));

/** Every string the app repeats across screens, worded once. A string used on one screen stays in its component. */
export const COPY = {
  credits: creditsText,
  rowCredits: creditsLabel,
  fraction: (n: number, total: number) => `${n} of ${total} credits`,
  degreeFigure: (n: number, total: number | null) =>
    total === null
      ? `${n} credits earned`
      : `${n} of ${total} degree credits earned`,
  minorFigure: (name: string, n: number, total: number, basis: Basis) =>
    `${minorTitle(name)}: ${n} of ${total} credits ${BASIS[basis]}`,
  basis: BASIS,
  pending: (n: number) => `${creditsText(n)} pending`,
  termsLeft: (n: number, term: Term) =>
    `${n} ${n === 1 ? "term" : "terms"} left, until ${termLabel(term)}`,
  termLoad: (n: number, limit: number) =>
    `${n} of ${limit} credits planned${n > limit ? ", over your limit" : ""}`,
  termCredits: creditsText,
  term: termLabel,
  termPair,
  now: "Now",
  plannedFor: (term: Term) => `Planned for ${termLabel(term)}`,
  notOfferedYear: `Not offered in ${meta.catalogueYear}`,
  notOfferedIn: (season: Season) => `Not offered in ${season}`,
  notOffered: "Not offered",
  needs: (text: string) => `Needs ${text} first`,
  notOpen: (codes: readonly string[]) =>
    `Not open to students who have taken ${list.format(codes)}`,
  /** What the replace group asks for, from the required courses met without credit. */
  replaces: (courses: readonly { code: string }[]) =>
    courses.length === 1
      ? `${courses[0]?.code} was exempted without credit. Make up its credits with any course and check with your advisor.`
      : `${list.format(courses.map((c) => c.code))} were exempted without credit. Make up their credits with any course and check with your advisor.`,
  hasConditions: "Has conditions",
  countsForBoth: "Counts for both",
  checkRequirement: "Check this requirement",
  catalogueLink: "McGill catalogue",
  generated: "Read automatically from the catalogue",
  minorTitle,
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
