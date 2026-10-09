import type { ProgramSummary } from "./types.ts";

/** Most minors say so in their id, but a few, like entrepreneurship-non-management-students, only have "Minor" as their degree. */
export const isMinor = ({
  id,
  degree,
}: Pick<ProgramSummary, "id" | "degree">) =>
  /(^|-)minor(-|$)/.test(id) || /minor/i.test(degree);

/** "Technological Entrepreneurship Minor" without its trailing "Minor", for places that already say "Minor". */
export const minorName = (name: string) => name.replace(/\s+minor$/i, "");
