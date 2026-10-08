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

/** The next six Fall and Winter terms after today's, plus every term the plan already uses, in order. */
export function planTermOptions(plan: Plan, today = new Date()): Term[] {
  const month = today.getMonth();
  const season = month < 4 ? "Winter" : month < 8 ? "Summer" : "Fall";
  const terms = new Map<number, Term>();
  for (
    let key = termKey({ season, year: today.getFullYear() }) + 1;
    terms.size < FALL_WINTER_TERMS;
    key++
  ) {
    const term = termFromKey(key);
    if (term.season !== "Summer") terms.set(key, term);
  }
  for (const { term } of plan) terms.set(termKey(term), term);
  return [...terms.values()].sort(compareTerms);
}
