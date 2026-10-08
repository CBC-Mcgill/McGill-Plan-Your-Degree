import { expect, test, vi } from "vitest";
import type { Transcript, TranscriptCourse } from "../transcript/parse.ts";
import { exportProfile, parseProfileFile } from "./file.ts";
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
