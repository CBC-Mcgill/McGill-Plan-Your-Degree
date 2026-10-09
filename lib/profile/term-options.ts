import { advanceTerms, currentTerm } from "./terms.ts";
import {
  compareTerms,
  type EntryRoute,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "./types.ts";

export function termLabel(term: Term): string {
  return `${term.season} ${term.year}`;
}

const FALL_WINTER_TERMS = 6;

export { currentTerm };

/** Summer is not a graduation term, so it counts as the Fall after it. */
const regular = (term: Term): Term =>
  term.season === "Summer" ? advanceTerms(term, 1) : term;

/** Fall and Winter terms a degree takes: six for a Quebec CEGEP student, eight for anyone else. */
const degreeTerms = (entry: EntryRoute | null) => (entry === "cegep" ? 6 : 8);

/** The last term of a typical degree from the start, but never before the last term the student has records in or the current one. */
export function defaultGraduation(
  start: Term,
  entry: EntryRoute | null = null,
  last: Term | null = null,
  now: Term = currentTerm(),
): Term {
  const guess = advanceTerms(regular(start), degreeTerms(entry) - 1);
  const floor = regular(last && compareTerms(last, now) > 0 ? last : now);
  return compareTerms(guess, floor) < 0 ? floor : guess;
}

/** The next six Fall and Winter terms after today's, plus every term the plan already uses, in order. */
export function planTermOptions(plan: Plan, today = new Date()): Term[] {
  const terms = new Map<number, Term>();
  for (
    let key = termKey(currentTerm(today)) + 1;
    terms.size < FALL_WINTER_TERMS;
    key++
  ) {
    const term = termFromKey(key);
    if (term.season !== "Summer") terms.set(key, term);
  }
  for (const { term } of plan) terms.set(termKey(term), term);
  return [...terms.values()].sort(compareTerms);
}
