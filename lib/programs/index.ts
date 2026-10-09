import coopSoftwareEngineering from "../../data/programs/co-op-software-engineering-beng.json";
import computerEngineering from "../../data/programs/computer-engineering-beng.json";
import computerScienceHonours from "../../data/programs/computer-science-honours-bsc.json";
import computerScienceMajor from "../../data/programs/computer-science-major-bsc.json";
import softwareEngineeringMajor from "../../data/programs/software-engineering-major-bsc.json";
import { isMinor } from "./minor.ts";
import type { Program, ProgramSummary } from "./types.ts";

export const PROGRAMS = [
  computerScienceMajor,
  computerScienceHonours,
  softwareEngineeringMajor,
  coopSoftwareEngineering,
  computerEngineering,
] as Program[];

/** Only the hand-written programs, for code that cannot wait on a fetch. Components load any program with `useProgram`. */
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

/** The transcript's degree mapped to the letters of the catalogue's degree, such as "bsc" for B.Sc. */
const DEGREE_LETTERS: Record<string, string> = {
  "bachelor of arts": "ba",
  "bachelor of arts and science": "basc",
  "bachelor of commerce": "bcom",
  "bachelor of engineering": "beng",
  "bachelor of music": "bmus",
  "bachelor of science": "bsc",
  "bachelor of social work": "bsw",
  "bachelor of theology": "bth",
};

const KINDS = /\b(major|minor|honours|concentration|joint|component)\b/g;

/** "Major Computer Science" and "Computer Science Major" both become the kind "major" and the name "computer science". */
function kindAndName(text: string): [kind: string, name: string] {
  const lower = text.toLowerCase().replace(/&/g, " and ");
  const kind = [...new Set(lower.match(KINDS))].sort().join(" ");
  const name = lower
    .replace(KINDS, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  return [kind, name];
}

/** True when the catalogue's degree, such as "B.Sc. or B.A.", includes the degree whose letters are given. */
const fitsDegree = (degree: string, letters: string) =>
  degree
    .toLowerCase()
    .split(/\s+or\s+/)
    .some((d) => d.replace(/[^a-z]/g, "") === letters);

function guessFromIndex(
  degree: string,
  lines: string[],
  index: readonly ProgramSummary[],
): string | null {
  const letters = DEGREE_LETTERS[degree];
  if (!letters) return null;
  const wanted = lines.map(kindAndName);
  const fits = index.filter(
    (program) =>
      !isMinor(program) &&
      fitsDegree(program.degree, letters) &&
      wanted.some(([kind, name]) => {
        const [programKind, programName] = kindAndName(program.name);
        return kind === programKind && name === programName;
      }),
  );
  return fits.length === 1 ? (fits[0]?.id ?? null) : null;
}

/** Maps the degree and program lines of a transcript to a program id, or null when none or several fit. The five hand-written programs match by exact line, then `index` is searched by degree and name. */
export function guessProgram(
  degree: string | null,
  programs: string[],
  index: readonly ProgramSummary[] = [],
): string | null {
  const lines = programs.map((line) => line.trim().toLowerCase());
  const wantedDegree = degree?.trim().toLowerCase() ?? "";
  const ids = new Set(
    GUESSES.filter(
      ([d, line]) => d === wantedDegree && lines.some((l) => line.test(l)),
    ).map(([, , program]) => program.id),
  );
  const [exact] = ids;
  return ids.size === 1 && exact
    ? exact
    : guessFromIndex(wantedDegree, lines, index);
}

/** Maps the minor lines of a transcript, such as "Minor Management", to a minor in `index`, or null when none or several fit. A minor whose degree is just "Minor" fits any degree. */
export function guessMinor(
  degree: string | null,
  minors: string[],
  index: readonly ProgramSummary[],
): string | null {
  const letters = DEGREE_LETTERS[degree?.trim().toLowerCase() ?? ""];
  const wanted = minors.map((line) => kindAndName(line)[1]);
  const fits = index.filter(
    (program) =>
      isMinor(program) &&
      (/^(supplementary )?minor$/i.test(program.degree) ||
        (letters !== undefined && fitsDegree(program.degree, letters))) &&
      wanted.includes(kindAndName(program.name)[1]),
  );
  return fits.length === 1 ? (fits[0]?.id ?? null) : null;
}
