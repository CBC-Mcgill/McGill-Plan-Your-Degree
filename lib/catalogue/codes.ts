// Matches COMP 251, ECSE 458D1 and NUR1 200.
const CODE = /(\b[A-Z][A-Z0-9]{3} \d{3}[A-Z0-9]{0,2}\b)/;

/** The text cut into runs, with `code` set on the runs that are course codes. `at` is the offset, a stable key. */
export function codeRuns(text: string) {
  let at = 0;
  return text
    .split(CODE)
    .map((run, i) => {
      const part = { at, run, code: i % 2 === 1 };
      at += run.length;
      return part;
    })
    .filter(({ run }) => run);
}
