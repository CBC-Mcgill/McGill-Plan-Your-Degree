import { compareTerms, type Term, termFromKey, termKey } from "./types.ts";

export const formatTerm = (term: Term) => `${term.season} ${term.year}`;

/** Winter is January to April, Summer May to August, Fall September to December. */
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

/** The latest term any of the items sits in. */
export function lastTerm(items: readonly { term: Term | null }[]): Term | null {
  return (
    items
      .flatMap((item) => item.term ?? [])
      .sort(compareTerms)
      .at(-1) ?? null
  );
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
