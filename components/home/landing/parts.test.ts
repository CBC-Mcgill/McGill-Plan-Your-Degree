import { expect, test } from "vitest";
import { loadCatalogue } from "@/lib/catalogue/server";
import { isOffered, leaves, meets } from "@/lib/engine/status";
import { credits, NEXT, PATH } from "./parts";

// The sample is written for a Fall term in progress, so even offsets are Fall terms.
const season = (offset: number) => (offset % 2 === 0 ? "Fall" : "Winter");

// What a student from CEGEP comes in with, which the first terms build on.
const CEGEP = ["MATH 133", "MATH 141"];

const needs = (tree: Parameters<typeof leaves>[0] | null | undefined) =>
  tree ? leaves(tree) : [];

test("every course of the landing's sample path is in the catalogue, runs in its term and comes after its prerequisites", async () => {
  const catalogue = await loadCatalogue();
  const taken = new Set(CEGEP);
  for (const term of PATH) {
    for (const course of term.courses) {
      const found = catalogue.get(course.code);
      const where = `${course.code} in ${season(term.offset)}`;
      expect(found?.title, where).toBe(course.title);
      if (!found) continue;
      expect(found.credits, where).toBe(credits(course));
      expect(isOffered(found, season(term.offset)), where).toBe(true);
      expect(meets(found.prerequisites?.tree, taken), where).toBe(true);
      expect(meets(found.corequisites?.tree, taken), where).toBe(true);
      expect(needs(found.prerequisites?.tree), where).toEqual(
        expect.arrayContaining(course.needs ?? []),
      );
    }
    for (const course of term.courses) taken.add(course.code);
  }
});

test("the landing's What's next sample checks real prerequisites and offerings", async () => {
  const catalogue = await loadCatalogue();
  for (const course of NEXT.flatMap((group) => group.courses)) {
    const found = catalogue.get(course.code);
    expect(found?.title, course.code).toBe(course.title);
    if (!found) continue;
    expect(isOffered(found, season(1)), course.code).toBe(
      course.offered !== false,
    );
    expect(needs(found.prerequisites?.tree), course.code).toEqual(
      expect.arrayContaining([
        ...course.checks,
        ...(course.missing ? [course.missing] : []),
      ]),
    );
  }
});
