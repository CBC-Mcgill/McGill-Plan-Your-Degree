/** Hues in the subject palette (`--subject-1` to `--subject-8` in globals.css). */
const HUES = 8;

// The subjects most students see get hues that differ from each other, and the rest hash into the palette.
const FIXED: Record<string, number> = {
  COMP: 1,
  ECSE: 2,
  MATH: 3,
  CHEM: 4,
  PHYS: 5,
  ECON: 6,
  MGCR: 7,
  FACC: 8,
};

/** The palette slot, 1 to 8, of a subject such as "COMP". The same subject always gets the same hue. */
export function subjectHue(subject: string): number {
  const fixed = FIXED[subject];
  if (fixed) return fixed;
  let hash = 0;
  for (const char of subject) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % HUES) + 1;
}
