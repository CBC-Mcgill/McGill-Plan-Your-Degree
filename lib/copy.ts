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

/** Every string the app repeats across screens, worded once. A string used on one screen stays in its component. */
export const COPY = {
  credits: creditsText,
  rowCredits: creditsLabel,
  fraction: (n: number, total: number) => `${n} of ${total} credits`,
  degreeFigure: (n: number, total: number | null) =>
    total === null
      ? `${n} credits earned`
      : `${n} of ${total} degree credits earned`,
  programFigure: (n: number, total: number, basis: Basis) =>
    `${n} of ${total} program credits ${BASIS[basis]}`,
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
  termPair: (a: Term, b: Term) => `${termLabel(a)} and ${termLabel(b)}`,
  now: "Now",
  plannedFor: (term: Term) => `Planned for ${termLabel(term)}`,
  notOfferedYear: `Not offered in ${meta.catalogueYear}`,
  notOfferedIn: (season: Season) => `Not offered in ${season}`,
  notOffered: "Not offered",
  needs: (text: string) => `Needs ${text} first`,
  notOpen: (codes: readonly string[]) =>
    `Not open to students who have taken ${list.format(codes)}`,
  hasConditions: "Has conditions",
  countsForBoth: "Counts for both",
  checkRequirement: "Check this requirement",
  catalogueLink: "McGill catalogue",
  generated: "Read automatically from the catalogue",
  minorTitle,
  importTranscript: "Import your transcript",
  startWithout: "Start without a transcript",
  restore: "Restore a backup",
  restoreWarning: "Replaces your current profile.",
  exportBackup: "Export a backup",
  reimport: "Re-import a transcript",
  deleteAll: "Delete all my data",
  pickProgram: "Pick your program",
  privacy: "Your transcript is read in this browser and never uploaded.",
  warnings: (n: number) => `${n} ${n === 1 ? "warning" : "warnings"}`,
  toast: {
    added: (code: string, term: Term) => `${code} added to ${termLabel(term)}`,
    moved: (code: string, term: Term) => `${code} moved to ${termLabel(term)}`,
    removed: (code: string, term: Term) =>
      `${code} removed from ${termLabel(term)}`,
  },
  undo: "Undo",
  advisor: "Advisor preview",
};
