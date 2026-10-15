import { expect, test, vi } from "vitest";
import type { Transcript, TranscriptCourse } from "../transcript/parse.ts";
import { exportProfile, parseProfileFile } from "./file.ts";
import { defaultGraduation, pastTermOptions } from "./term-options.ts";
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
  expect(
    state.records.map((r) => [r.code, r.part, r.status, r.source]),
  ).toEqual([
    ["MATH 240", undefined, "completed", "manual"],
    ["ECSE 458", "D1", "in-progress", "transcript"],
    ["ECSE 458", "D2", "completed", "transcript"],
    ["COMP 250", undefined, "failed", "transcript"],
    ["COMP 202", undefined, "exemption", "transcript"],
  ]);
  expect(state.startTerm).toEqual(fall2024);
  expect(state.programId).toBe("software-engineering-major-bsc");
});

test("setMarked undo removes only the record it wrote", () => {
  store.getState().reset();
  store
    .getState()
    .applyTranscript(transcript([line("ANTH 502", fall2024, "in-progress")]));
  const { setMarked } = store.getState();
  setMarked("ANTH 502", fall2024, "in-progress", true);
  setMarked("ANTH 502", null, "completed", true);
  expect(store.getState().records).toHaveLength(3);
  setMarked("ANTH 502", fall2024, "in-progress", false);
  setMarked("ANTH 502", null, "completed", false);
  expect(
    store.getState().records.map((r) => [r.code, r.term, r.source]),
  ).toEqual([["ANTH 502", fall2024, "transcript"]]);
});

test("parseProfileFile rejects a malformed file and round-trips an export", () => {
  const rule = "economics-major-concentration-ba\u0000Rule";
  store.getState().setChecked(rule, true);
  store.getState().setAssigned(rule, ["ECON 340", "ECON 468"]);
  store.getState().setAssigned(`${rule} 2`, []);
  const exported = exportProfile(store.getState());
  expect(parseProfileFile(exported)).toEqual({
    ok: true,
    profile: JSON.parse(exported).profile,
  });
  const { checked, assigned } = JSON.parse(exported).profile;
  expect(checked).toEqual([rule]);
  expect(assigned).toEqual({ [rule]: ["ECON 340", "ECON 468"] });

  const file = JSON.parse(exported);
  file.profile.records[0].status = "graduated";
  expect(parseProfileFile(JSON.stringify(file))).toEqual({
    ok: false,
    error: expect.stringContaining("profile.records[0].status"),
  });
  const listed = JSON.parse(exported);
  listed.profile.assigned[rule] = ["ECON 340", "not a code"];
  expect(parseProfileFile(JSON.stringify(listed))).toEqual({
    ok: false,
    error: expect.stringContaining("profile.assigned[0][1]"),
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

test("a version 3 file loads without a minor, and a minor survives an export", () => {
  const file = {
    format: "plan-your-degree-profile",
    version: 3,
    profile: {
      records: [],
      programId: null,
      entry: null,
      advancedStanding: 0,
      creditsRequired: null,
      startTerm: null,
      graduationTerm: null,
      plan: [],
      creditLimit: 17,
      importedAt: null,
    },
  };
  expect(parseProfileFile(JSON.stringify(file))).toMatchObject({
    ok: true,
    profile: { minorId: null, checked: [], assigned: {} },
  });
  const exported = exportProfile({
    ...store.getState(),
    minorId: "statistics-minor-bsc",
  });
  expect(parseProfileFile(exported)).toMatchObject({
    ok: true,
    profile: { minorId: "statistics-minor-bsc" },
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

test("defaultGraduation guesses two years for a master's and four for a doctorate", () => {
  const start: Term = { season: "Fall", year: 2026 };
  const now: Term = { season: "Fall", year: 2026 };
  const guess = (credits: number, entry: "cegep" | null = null) =>
    defaultGraduation(start, entry, null, now, { level: "graduate", credits });
  expect(guess(45)).toEqual({ season: "Winter", year: 2028 });
  expect(guess(45, "cegep")).toEqual({ season: "Winter", year: 2028 });
  expect(guess(0)).toEqual({ season: "Winter", year: 2030 });
  expect(defaultGraduation(start, null, null, now, { credits: 90 })).toEqual({
    season: "Winter",
    year: 2030,
  });
});

test("pastTermOptions runs from the start to the term before today's, or six back", () => {
  const today = new Date("2026-10-15T12:00:00");
  const label = (terms: Term[]) => terms.map((t) => `${t.season} ${t.year}`);
  expect(label(pastTermOptions({ season: "Fall", year: 2025 }, today))).toEqual(
    ["Fall 2025", "Winter 2026"],
  );
  expect(label(pastTermOptions(null, today))).toEqual([
    "Fall 2023",
    "Winter 2024",
    "Fall 2024",
    "Winter 2025",
    "Fall 2025",
    "Winter 2026",
  ]);
});
