import type { ProgramSummary } from "./types.ts";

type Named = Pick<ProgramSummary, "id" | "name" | "degree">;

/** Most minors say so in their id, French ones as "mineure", but a few, like entrepreneurship-non-management-students, only have "Minor" as their degree. */
export const isMinor = ({
  id,
  degree,
}: Pick<ProgramSummary, "id" | "degree">) =>
  /(^|-)(?:minor|mineure)(-|$)/.test(id) || /minor/i.test(degree);

/** "Technological Entrepreneurship Minor" without its trailing "Minor", for places that already say "Minor". */
export const minorName = (name: string) => name.replace(/\s+minor$/i, "");

/** How the program and the second program fit together. "liberal" is a B.Sc. Liberal core with its breadth component, which can itself be a minor. "extra" is the extra minor beside both, which `pairOf` never returns. */
export type Pair = "minor" | "joint" | "majors" | "liberal" | "other" | "extra";

const is = (pattern: RegExp, { id, name }: Named) =>
  pattern.test(id) || pattern.test(name);
const JOINT = /joint[- ]honours[- ]component/i;
const MAJOR = /(^|[-\s])major([-\s]|$)/i;
const LIBERAL_CORE = /liberal[- ]program\W+core/i;

/** The pair a profile holds, read from the two programs' names and ids. No second program reads as a minor, the way the profile always has. */
export function pairOf(program: Named | null, second: Named | null): Pair {
  if (!second) return "minor";
  if (program && is(LIBERAL_CORE, program)) return "liberal";
  if (isMinor(second)) return "minor";
  if (!program) return "other";
  if (is(JOINT, program) && is(JOINT, second)) return "joint";
  if (is(MAJOR, program) && is(MAJOR, second)) return "majors";
  return "other";
}
