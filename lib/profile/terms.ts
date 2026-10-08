import { compareTerms, type Term, termFromKey, termKey } from "./types.ts";

export const formatTerm = (term: Term) => `${term.season} ${term.year}`;

export function currentTerm(now = new Date()): Term {
  const month = now.getMonth();
  const season = month < 4 ? "Winter" : month < 8 ? "Summer" : "Fall";
  return { season, year: now.getFullYear() };
}

/** Steps forward over Fall and Winter terms only, since Summer is optional. */
export function advanceTerms(from: Term, steps: number): Term {
  let at = termKey(from);
  for (let i = 0; i < steps; i++) {
    do at++;
    while (termFromKey(at).season === "Summer");
  }
  return termFromKey(at);
}

/** Every term from Winter of firstYear to Fall of lastYear, plus the extra ones given. */
export function termRange(
  firstYear: number,
  lastYear: number,
  extra: (Term | null)[] = [],
): Term[] {
  const keys = new Set(extra.flatMap((term) => (term ? termKey(term) : [])));
  for (let k = firstYear * 3; k < (lastYear + 1) * 3; k++) keys.add(k);
  return [...keys].sort((a, b) => a - b).map(termFromKey);
}

const CREDITS_PER_TERM = 15;
const DEGREE_TERMS = 8;

/** A starting guess for graduation: a four-year degree, or the credits left at 15 per Fall or Winter term. */
export function guessGraduation(
  start: Term | null,
  last: Term | null,
  creditsLeft: number | null,
): Term | null {
  if (last && creditsLeft !== null) {
    return advanceTerms(
      last,
      Math.ceil(Math.max(0, creditsLeft) / CREDITS_PER_TERM),
    );
  }
  return start ? advanceTerms(start, DEGREE_TERMS - 1) : null;
}

/** Groups by term from oldest to newest, with the entries that have no term first. */
export function groupByTerm<T extends { term: Term | null }>(
  items: T[],
): { term: Term | null; items: T[] }[] {
  const groups = new Map<number, { term: Term | null; items: T[] }>();
  for (const item of items) {
    const id = item.term ? termKey(item.term) : -1;
    const group = groups.get(id) ?? { term: item.term, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.term && b.term ? compareTerms(a.term, b.term) : a.term ? 1 : -1,
  );
}
