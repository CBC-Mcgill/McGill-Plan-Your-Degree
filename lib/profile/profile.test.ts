import { expect, test, vi } from "vitest";
import type { Transcript, TranscriptCourse } from "../transcript/parse.ts";
import { exportProfile, parseProfileFile } from "./file.ts";
import { defaultGraduation } from "./term-options.ts";
import type { Term } from "./types.ts";

const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
});
const { useProfileStore } = await import("./store.ts");
const store = useProfileStore;

const fall2024: Term = { season: "Fall", year: 2024 };
const winter2025: Term = { season: "Winter", year: 2025 };

const line = (
  code: string,
  term: Term | null,
  status: TranscriptCourse["status"],
  grade: string | null = null,
): TranscriptCourse => ({
  code,
  title: null,
  term,
  credits: 3,
  grade,
  remarks: null,
  earnedCredits: null,
  multiTerm: false,
  status,
});

const transcript = (courses: TranscriptCourse[]): Transcript => ({
  degree: null,
  programs: [],
  minors: [],
  creditsRequired: null,
  previousEducation: null,
  advancedStanding: 0,
  courses,
  unrecognized: [],
});

test("applyTranscript maps lines to records and keeps manual ones", () => {
  store
    .getState()
    .applyTranscript(transcript([line("OLD 101", null, "transfer")]));
  store.getState().addCourse({
    code: "MATH 240",
    term: null,
    credits: 3,
    grade: null,
    status: "completed",
  });
  store
    .getState()
    .applyTranscript(
      transcript([
        line("ECSE 458D1", fall2024, "in-progress"),
        line("ECSE 458D2", winter2025, "completed", "A"),
        line("COMP 250", winter2025, "failed", "F"),
        line("COMP 202", null, "exemption"),
      ]),
      "software-engineering-major-bsc",
    );

  const state = store.getState();
  expect(state.records.map((r) => [r.code, r.status, r.source])).toEqual([
    ["MATH 240", "completed", "manual"],
    ["ECSE 458", "in-progress", "transcript"],
    ["ECSE 458", "completed", "transcript"],
    ["COMP 250", "failed", "transcript"],
    ["COMP 202", "exemption", "transcript"],
  ]);
  expect(state.startTerm).toEqual(fall2024);
  expect(state.programId).toBe("software-engineering-major-bsc");
});

test("parseProfileFile rejects a malformed file and round-trips an export", () => {
  const exported = exportProfile(store.getState());
  expect(parseProfileFile(exported)).toEqual({
    ok: true,
    profile: JSON.parse(exported).profile,
  });

  const file = JSON.parse(exported);
  file.profile.records[0].status = "graduated";
  expect(parseProfileFile(JSON.stringify(file))).toEqual({
    ok: false,
    error: expect.stringContaining("profile.records[0].status"),
  });
  expect(parseProfileFile("not json").ok).toBe(false);
});

test("parseProfileFile migrates a version 1 file to version 2", () => {
  const file = {
    format: "plan-your-degree-profile",
    version: 1,
    profile: {
      records: [],
      programId: null,
      startTerm: null,
      graduationTerm: null,
      plan: [],
      creditLimit: 17,
      importedAt: null,
    },
  };
  expect(parseProfileFile(JSON.stringify(file))).toMatchObject({
    ok: true,
    profile: { entry: null, advancedStanding: 0, creditsRequired: null },
  });
});

test("parseProfileFile drops a credits required that only repeats the default", () => {
  const file = (programId: string, creditsRequired: number) => ({
    format: "plan-your-degree-profile",
    version: 2,
    profile: {
      records: [],
      programId,
      entry: "cegep",
      advancedStanding: 0,
      creditsRequired,
      startTerm: null,
      graduationTerm: null,
      plan: [],
      creditLimit: 17,
      importedAt: null,
    },
  });
  const credits = (programId: string, typed: number) => {
    const result = parseProfileFile(JSON.stringify(file(programId, typed)));
    return result.ok && result.profile.creditsRequired;
  };
  expect(credits("computer-science-major-bsc", 90)).toBeNull();
  expect(credits("computer-science-major-bsc", 100)).toBe(100);
  expect(credits("computer-engineering-beng", 90)).toBe(90);
});

test("defaultGraduation follows entry and never lands in the past", () => {
  const start: Term = { season: "Fall", year: 2025 };
  const now: Term = { season: "Fall", year: 2026 };
  expect(defaultGraduation(start, "cegep", null, now)).toEqual({
    season: "Winter",
    year: 2028,
  });
  expect(defaultGraduation(start, "foundation", null, now)).toEqual({
    season: "Winter",
    year: 2029,
  });
  expect(
    defaultGraduation({ season: "Fall", year: 2020 }, null, null, now),
  ).toEqual(now);
});
