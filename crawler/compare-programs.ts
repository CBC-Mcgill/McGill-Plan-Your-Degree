import type {
  Group,
  Program,
  RequiredItem,
  Rule,
} from "../lib/programs/types.ts";
import { programCourseCodes } from "../lib/programs/validate.ts";

const MAX_COUNT_DROP = 0.05;

/** One line of index.json, enough to list programs without loading each file. */
export interface IndexEntry {
  id: string;
  name: string;
  degree: string;
  faculty: string;
  credits: number;
  unparsedRules: number;
}

const rulesOf = (program: Program): Rule[] =>
  program.groups.flatMap((group) =>
    group.kind === "complementary" ? group.rules : [],
  );

const unparsedCount = (program: Program) =>
  rulesOf(program).filter((rule) => rule.unparsed).length;

export function indexOf(programs: Program[]): IndexEntry[] {
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    degree: p.degree,
    faculty: p.faculty,
    credits: p.credits,
    unparsedRules: unparsedCount(p),
  }));
}

/** Fails the run when the new crawl looks broken compared to the previous catalogue year folder. */
export function checkGuardrails(previous: IndexEntry[], next: Program[]) {
  if (previous.length === 0) return;
  const drop = (previous.length - next.length) / previous.length;
  if (drop > MAX_COUNT_DROP) {
    throw new Error(
      `Program count dropped from ${previous.length} to ${next.length}, more than ${MAX_COUNT_DROP * 100}%`,
    );
  }
}

const normalize = (text: string) =>
  text
    .replace(/\b[A-Z]{3}[A-Z\d] \d{3}(?:[DJN]\d)?\b/g, "CODE")
    .replace(/\d+(?:\.\d+)?/g, "N");

/** The most common unparsed catalogue sentences, with numbers and course codes blanked so similar ones group. */
export function topUnparsed(programs: Program[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const program of programs) {
    for (const rule of rulesOf(program)) {
      if (!rule.unparsed) continue;
      const key = normalize(rule.title).slice(0, 120);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([text, count]) => `${count} x ${text}`);
}

const itemKey = (item: RequiredItem) =>
  typeof item === "string" ? item : [...item.oneOf].sort().join(" or ");
const codesKey = (codes: string[] = []) => [...codes].sort().join(" ");
const only = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
const same = (a: string[], b: string[]) =>
  only(a, b).length === 0 && only(b, a).length === 0;

function matchGroup(hand: Group, candidates: Group[]): Group | undefined {
  const title = hand.title.toLowerCase();
  const named = (g: Group) => g.kind === hand.kind && g.title.toLowerCase();
  return (
    candidates.find((g) => named(g) === title) ??
    candidates.find(
      (g) => g.kind === hand.kind && g.title.toLowerCase().startsWith(title),
    )
  );
}

function compareRules(hand: Rule[], generated: Rule[]): string[] {
  const lines: string[] = [];
  const left = [...generated];
  for (const rule of hand) {
    const at = left.findIndex(
      (g) =>
        !g.unparsed &&
        (rule.courses
          ? codesKey(g.courses) === codesKey(rule.courses)
          : JSON.stringify(g.match) === JSON.stringify(rule.match)),
    );
    const found = left[at];
    if (!found) {
      lines.push(`rule not generated: ${rule.title}`);
      continue;
    }
    left.splice(at, 1);
    for (const key of [
      "minCredits",
      "maxCredits",
      "minCourses",
      "maxCourses",
    ] as const) {
      if (rule[key] !== found[key]) {
        lines.push(
          `rule "${rule.title}": ${key} ${rule[key] ?? "none"} by hand, ${found[key] ?? "none"} generated`,
        );
      }
    }
  }
  for (const rule of left) {
    lines.push(
      rule.unparsed
        ? `unparsed: ${rule.title.slice(0, 100)}`
        : `extra rule: ${rule.title.slice(0, 100)}`,
    );
  }
  return lines;
}

/** What differs between a hand-written program file and the generated one: groups, credits, course sets and rule caps. */
export function compareWithHandWritten(
  hand: Program,
  generated: Program | undefined,
): string[] {
  if (!generated) return ["not generated"];
  const lines: string[] = [];
  if (hand.credits !== generated.credits) {
    lines.push(
      `credits ${hand.credits} by hand, ${generated.credits} generated`,
    );
  }
  if (hand.name !== generated.name) {
    lines.push(`name "${hand.name}" by hand, "${generated.name}" generated`);
  }
  if (hand.degree !== generated.degree || hand.faculty !== generated.faculty) {
    lines.push(
      `degree and faculty ${hand.degree}, ${hand.faculty} by hand, ${generated.degree}, ${generated.faculty} generated`,
    );
  }
  const used = new Set<Group>();
  for (const group of hand.groups) {
    const found = matchGroup(group, generated.groups);
    const name = `${group.kind} "${group.title}"`;
    if (!found) {
      lines.push(`${name}: no generated group with that title`);
      continue;
    }
    used.add(found);
    if (group.credits !== found.credits) {
      lines.push(
        `${name}: credits ${group.credits} by hand, ${found.credits} generated`,
      );
    }
    if (group.foundation !== found.foundation) {
      lines.push(`${name}: foundation flag differs`);
    }
    if (group.kind === "required" && found.kind === "required") {
      const a = group.courses.map(itemKey);
      const b = found.courses.map(itemKey);
      if (!same(a, b)) {
        lines.push(
          `${name}: courses only by hand [${only(a, b).join(", ")}], only generated [${only(b, a).join(", ")}]`,
        );
      }
    } else if (
      group.kind === "complementary" &&
      found.kind === "complementary"
    ) {
      if (group.minCourses !== found.minCourses) {
        lines.push(
          `${name}: minCourses ${group.minCourses ?? "none"} by hand, ${found.minCourses ?? "none"} generated`,
        );
      }
      for (const line of compareRules(group.rules, found.rules)) {
        lines.push(`${name}: ${line}`);
      }
    }
  }
  for (const group of generated.groups) {
    if (!used.has(group)) {
      lines.push(`${group.kind} "${group.title}": only in the generated file`);
    }
  }
  return lines;
}

/** Programs whose groups add up to more or fewer credits than the program, which often means alternatives were read as requirements or a section was skipped. */
export function creditMismatches(programs: Program[]) {
  const sum = (p: Program) => p.groups.reduce((n, g) => n + g.credits, 0);
  return {
    over: programs.filter((p) => sum(p) > p.credits).map((p) => p.id),
    under: programs.filter((p) => sum(p) < p.credits).map((p) => p.id),
  };
}

/** Course codes the programs name that the course catalogue has no page for, with how many programs name each. */
export function missingCourses(
  programs: Program[],
  catalogue: Set<string>,
): Map<string, number> {
  const missing = new Map<string, number>();
  for (const program of programs) {
    for (const code of programCourseCodes(program)) {
      if (!catalogue.has(code)) missing.set(code, (missing.get(code) ?? 0) + 1);
    }
  }
  return missing;
}

export interface Summary {
  found: number;
  skipped: string[];
  programs: Program[];
  hand: { program: Program; generated: Program | undefined }[];
  previous: IndexEntry[];
  missing: Map<string, number>;
}

/** A Markdown summary of the program crawl for the data PR. */
export function summarize({
  found,
  skipped,
  programs,
  hand,
  previous,
  missing,
}: Summary): string {
  const withUnparsed = programs.filter((p) => unparsedCount(p) > 0).length;
  const unparsed = programs.reduce((sum, p) => sum + unparsedCount(p), 0);
  const rules = programs.reduce((sum, p) => sum + rulesOf(p).length, 0);
  const { over, under } = creditMismatches(programs);
  return [
    "## Program crawl",
    "",
    `- Program pages found: ${found}`,
    `- Programs written: ${programs.length} (was ${previous.length})`,
    `- Pages skipped for having no requirements: ${skipped.length}`,
    `- Programs with unparsed rules: ${withUnparsed} of ${programs.length}`,
    `- Complementary rules kept as raw text: ${unparsed} of ${rules}`,
    `- Programs whose groups add up to more credits than the program: ${over.length}`,
    `- Programs whose groups add up to fewer credits than the program: ${under.length}`,
    `- Course codes with no page in the course catalogue: ${missing.size}${
      missing.size
        ? ` (${[...missing].map(([code, n]) => `${code} in ${n} programs`).join(", ")})`
        : ""
    }`,
    "",
    "### Most common unparsed phrasings",
    "",
    ...topUnparsed(programs).map((line) => `- ${line}`),
    "",
    "### Hand-written programs against generated",
    "",
    ...hand.flatMap(({ program, generated }) => {
      const lines = compareWithHandWritten(program, generated);
      return [
        `- ${program.id}: ${lines.length === 0 ? "identical" : `${lines.length} differences`}`,
        ...lines.map((line) => `  - ${line}`),
      ];
    }),
    "",
  ].join("\n");
}
