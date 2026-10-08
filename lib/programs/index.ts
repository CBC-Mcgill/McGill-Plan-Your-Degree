import coopSoftwareEngineering from "../../data/programs/co-op-software-engineering-beng.json";
import computerEngineering from "../../data/programs/computer-engineering-beng.json";
import computerScienceHonours from "../../data/programs/computer-science-honours-bsc.json";
import computerScienceMajor from "../../data/programs/computer-science-major-bsc.json";
import softwareEngineeringMajor from "../../data/programs/software-engineering-major-bsc.json";
import type { Program } from "./types.ts";

export const PROGRAMS = [
  computerScienceMajor,
  computerScienceHonours,
  softwareEngineeringMajor,
  coopSoftwareEngineering,
  computerEngineering,
] as Program[];

export function getProgram(id: string): Program | undefined {
  return PROGRAMS.find((program) => program.id === id);
}

const BSC = "bachelor of science";
const BENG = "bachelor of engineering";

/** Transcript degree, a regex for one program line, and the program it means. */
const GUESSES: [degree: string, line: RegExp, program: Program][] = [
  [BSC, /^(major )?computer science$/, computerScienceMajor as Program],
  [BSC, /^honours computer science$/, computerScienceHonours as Program],
  [BSC, /^(major )?software engineering$/, softwareEngineeringMajor as Program],
  [BENG, /^co-op .*software engineering$/, coopSoftwareEngineering as Program],
  [BENG, /^computer engineering$/, computerEngineering as Program],
];

/** Maps the degree and program lines of a transcript to a program id, or null when none or several fit. */
export function guessProgram(
  degree: string | null,
  programs: string[],
): string | null {
  const lines = programs.map((line) => line.trim().toLowerCase());
  const ids = new Set(
    GUESSES.filter(
      ([d, line]) =>
        d === degree?.trim().toLowerCase() && lines.some((l) => line.test(l)),
    ).map(([, , program]) => program.id),
  );
  return ids.size === 1 ? ([...ids][0] ?? null) : null;
}
