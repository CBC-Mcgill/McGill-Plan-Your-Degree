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
  "master of arts": "ma",
  "master of business administration": "mba",
  "master of engineering": "meng",
  "master of laws": "llm",
  "master of music": "mmus",
  "master of science": "msc",
  "doctor of philosophy": "phd",
};

const KINDS = /\b(major|minor|honours|concentration|joint|thesis|nonthesis)\b/g;

/** "Major Computer Science" and "Computer Science Major" both become the kind "major" and the name "computer science", as "Computer Science (Thesis)" becomes "thesis" and "computer science". "Component" is dropped, so "Joint Honours Economics" fits "Economics Joint Honours Component". */
function kindAndName(text: string): [kind: string, name: string] {
  const lower = text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bcomponent\b/g, " ")
    .replace(/\bnon[\s-]*thesis\b/g, "nonthesis");
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

/** For each program line, the programs of `index` it names in the transcript's degree. */
function fitsByLine(
  degree: string,
  lines: string[],
  index: readonly ProgramSummary[],
): ProgramSummary[][] {
  const letters = DEGREE_LETTERS[degree];
  return lines.map((line) => {
    const [kind, name] = kindAndName(line);
    return letters
      ? index.filter((program) => {
          const [programKind, programName] = kindAndName(program.name);
          return (
            !isMinor(program) &&
            fitsDegree(program.degree, letters) &&
            kind === programKind &&
            name === programName
          );
        })
      : [];
  });
}

/** The two programs of two program lines, such as two joint honours components or two majors, when exactly one program fits each. */
function twoPrograms(byLine: ProgramSummary[][]): [string, string] | null {
  const [first, second] = byLine.map((fits) =>
    fits.length === 1 ? fits[0]?.id : undefined,
  );
  return byLine.length === 2 && first && second && first !== second
    ? [first, second]
    : null;
}

function guessFromIndex(
  degree: string,
  lines: string[],
  index: readonly ProgramSummary[],
): string | null {
  const byLine = fitsByLine(degree, lines, index);
  const fits = new Set(byLine.flat());
  const [only] = fits;
  return fits.size === 1 && only ? only.id : (twoPrograms(byLine)?.[0] ?? null);
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

/** With two program lines, the program that is not `programId`, so a second joint honours component or a second major fills the profile's second program. */
export function guessSecond(
  degree: string | null,
  programs: string[],
  programId: string | null,
  index: readonly ProgramSummary[],
): string | null {
  const pair = twoPrograms(
    fitsByLine(degree?.trim().toLowerCase() ?? "", programs, index),
  );
  return pair && programId && pair.includes(programId)
    ? (pair.find((id) => id !== programId) ?? null)
    : null;
}

/** Maps each minor line of a transcript, such as "Minor Management", to a minor in `index`, in line order, leaving out a line that none or several fit. A minor whose degree is just "Minor" fits any degree. */
export function guessMinors(
  degree: string | null,
  minors: string[],
  index: readonly ProgramSummary[],
): string[] {
  const letters = DEGREE_LETTERS[degree?.trim().toLowerCase() ?? ""];
  const ids = minors.flatMap((line) => {
    const wanted = kindAndName(line)[1];
    const fits = index.filter(
      (program) =>
        isMinor(program) &&
        (/^(supplementary )?minor$/i.test(program.degree) ||
          (letters !== undefined && fitsDegree(program.degree, letters))) &&
        kindAndName(program.name)[1] === wanted,
    );
    return fits.length === 1 && fits[0] ? [fits[0].id] : [];
  });
  return [...new Set(ids)];
}
