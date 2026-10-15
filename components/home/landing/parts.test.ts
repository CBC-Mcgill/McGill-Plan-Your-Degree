import { expect, test } from "vitest";
import { loadCatalogue } from "@/lib/catalogue/server";
import { isOffered, leaves, meets } from "@/lib/engine/status";
import { credits, NEXT, PATH } from "./parts";

/** DEC courses a CEGEP student holds credit for, which the sample's first courses need. */
const CEGEP = [
  "MATH 133",
  "MATH 140",
  "MATH 141",
  "PHYS 131",
  "PHYS 142",
  "CHEM 110",
  "CHEM 120",
  "BIOL 112",
];

/** The sample is drawn with this term in Fall, so even offsets are Fall terms. */
const season = (offset: number) => (offset % 2 === 0 ? "Fall" : "Winter");

test("the landing sample matches the catalogue", async () => {
  const catalogue = await loadCatalogue();
  const find = (code: string) => {
    const course = catalogue.get(code);
    if (!course) throw new Error(`${code} is not in the catalogue`);
    return course;
  };

  const taken = new Set(CEGEP);
  for (const term of PATH) {
    for (const course of term.courses) {
      const found = find(course.code);
      expect([found.title, found.credits]).toEqual([
        course.title,
        credits(course),
      ]);
      if (term.offset > 0) {
        expect(isOffered(found, season(term.offset)), course.code).toBe(true);
        expect(meets(found.prerequisites?.tree, taken), course.code).toBe(true);
      }
    }
    for (const course of term.courses) taken.add(course.code);
  }

  const before = new Set([
    ...CEGEP,
    ...PATH.filter((term) => term.offset <= 0).flatMap((term) =>
      term.courses.map((course) => course.code),
    ),
  ]);
  for (const course of NEXT.flatMap((group) => group.courses)) {
    const found = find(course.code);
    const tree = found.prerequisites?.tree;
    expect(found.title).toBe(course.title);
    expect(tree ? leaves(tree) : []).toEqual(
      expect.arrayContaining([
        ...course.checks,
        ...(course.missing ? [course.missing] : []),
      ]),
    );
    expect(course.checks.every((code) => before.has(code))).toBe(true);
    expect(meets(tree, before), course.code).toBe(!course.missing);
    expect(isOffered(found, season(1)), course.code).toBe(
      course.offered !== false,
    );
  }
});
