import { expect, test } from "vitest";
import { FIRST_PAINT, PROFILE_STORAGE_KEY } from "./first-paint.ts";
import { isStarted } from "./started.ts";

const run = (stored: unknown) => {
  const dataset: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) =>
      key === PROFILE_STORAGE_KEY && stored ? JSON.stringify(stored) : null,
  };
  new Function("localStorage", "document", FIRST_PAINT)(localStorage, {
    documentElement: { dataset },
  });
  return dataset;
};

type Started = Parameters<typeof isStarted>[0];
const fall = { season: "Fall", year: 2026 } as const;
const empty: Started = {
  records: [],
  plan: [],
  programId: null,
  startTerm: null,
};

test("the first-paint script agrees with isStarted", () => {
  const states: Started[] = [
    empty,
    { ...empty, startTerm: fall },
    { ...empty, programId: "cs-major" },
    { ...empty, plan: [{ term: fall, courses: ["COMP 250"] }] },
  ];
  for (const state of states) {
    expect("returning" in run({ state, version: 4 })).toBe(isStarted(state));
  }
  expect(run(null)).toEqual({});
});
