import {
  compareTerms,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "./types.ts";

export function termLabel(term: Term): string {
  return `${term.season} ${term.year}`;
}

const FALL_WINTER_TERMS = 6;

/** Winter is January to April, Summer May to August, Fall September to December. */
export function currentTerm(today = new Date()): Term {
  const month = today.getMonth();
  return {
    season: month < 4 ? "Winter" : month < 8 ? "Summer" : "Fall",
    year: today.getFullYear(),
  };
}

/** Eight Fall and Winter terms from the start, the length of a four-year degree. */
export function defaultGraduation(start: Term): Term {
  const first: Term =
    start.season === "Summer" ? { season: "Fall", year: start.year } : start;
  return termFromKey(termKey(first) + (first.season === "Fall" ? 10 : 11));
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
