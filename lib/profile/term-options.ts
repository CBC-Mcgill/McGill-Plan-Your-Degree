import type { Program } from "../programs/types.ts";
import { advanceTerms, currentTerm } from "./terms.ts";
import {
  compareTerms,
  type EntryRoute,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "./types.ts";

/** A Fall or Winter term counted from the academic year's Fall, so a sample never looks dated and its seasons stay true all year: 0 is that Fall (the one behind in Winter, the one ahead in Summer), -1 the term before, 1 the term after. */
export function sampleTerm(offset: number, now = new Date()): Term {
  const term = currentTerm(now);
  let key = termKey(term) + { Fall: 0, Winter: -1, Summer: 1 }[term.season];
  const step = Math.sign(offset);
  for (let i = 0; i < Math.abs(offset); i++) {
    do key += step;
    while (termFromKey(key).season === "Summer");
  }
  return termFromKey(key);
}

export function termLabel(term: Term): string {
  return `${term.season} ${term.year}`;
}

const FALL_WINTER_TERMS = 6;

export { currentTerm };

/** Summer is not a graduation term, so it counts as the Fall after it. */
const regular = (term: Term): Term =>
  term.season === "Summer" ? advanceTerms(term, 1) : term;

/** Fall and Winter terms a degree takes: four for a master's, certificate or diploma, eight for a doctorate, else six for a Quebec CEGEP student and eight for anyone else. */
function degreeTerms(
  entry: EntryRoute | null,
  program: Pick<Program, "level" | "credits"> | null,
) {
  if (program?.level === "graduate") return program.credits === 0 ? 8 : 4;
  return entry === "cegep" ? 6 : 8;
}

/** The last term of a typical degree from the start, but never before the last term the student has records in or the current one. A graduate program ignores the entry route. */
export function defaultGraduation(
  start: Term,
  entry: EntryRoute | null = null,
  last: Term | null = null,
  now: Term = currentTerm(),
  program: Pick<Program, "level" | "credits"> | null = null,
): Term {
  const guess = advanceTerms(regular(start), degreeTerms(entry, program) - 1);
  const floor = regular(last && compareTerms(last, now) > 0 ? last : now);
  return compareTerms(guess, floor) < 0 ? floor : guess;
}

/** The Fall and Winter terms from the start to the one before today's, or the last six without a start. */
export function pastTermOptions(
  start: Term | null,
  today = new Date(),
): Term[] {
  const terms: Term[] = [];
  for (
    let key = termKey(currentTerm(today)) - 1;
    start ? key >= termKey(start) : terms.length < FALL_WINTER_TERMS;
    key--
  ) {
    const term = termFromKey(key);
    if (term.season !== "Summer") terms.unshift(term);
  }
  return terms;
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
