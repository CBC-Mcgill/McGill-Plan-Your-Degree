"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { forgetRecentCourses } from "../recent-courses.ts";
import type { Transcript, TranscriptCourse } from "../transcript/parse.ts";
import { migrateProfile, PROFILE_VERSION } from "./file.ts";
import {
  type CourseRecord,
  compareTerms,
  isCegep,
  logicalCode,
  type Plan,
  type Profile,
  partOf,
  type Term,
  termKey,
} from "./types.ts";

export const PROFILE_STORAGE_KEY = "plan-your-degree:profile";

// An earlier version stored its own state under this key, so clear it once.
try {
  localStorage.removeItem("plan-your-degree:seen");
} catch {
  // Blocked storage, or running on the server.
}

/** True while the last save to the browser's storage failed, so the profile only lives in memory. */
export const useSaveStatus = create<{ failed: boolean }>(() => ({
  failed: false,
}));

/** localStorage that survives being blocked or full: the profile stays in memory and the failure shows in `useSaveStatus`. */
const storage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      useSaveStatus.setState({ failed: false });
    } catch {
      useSaveStatus.setState({ failed: true });
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing is stored, so there is nothing to remove.
    }
  },
};

export interface ProfileActions {
  /** Replaces the earlier transcript records, keeps manual ones, and starts the profile at the earliest term. A CEGEP transcript sets the entry, any other leaves it as it is. */
  applyTranscript: (transcript: Transcript, programId?: string) => void;
  /** Replaces the record with the same code, part and term, if any. */
  addCourse: (record: Omit<CourseRecord, "source">) => void;
  /** Removes every record of the course, or only the records of one part of a multi-term course. */
  removeCourse: (code: string, part?: string) => void;
  setProgram: (programId: string | null) => void;
  setMinor: (minorId: string | null) => void;
  setBackground: (
    background: Partial<
      Pick<Profile, "entry" | "advancedStanding" | "creditsRequired">
    >,
  ) => void;
  setTerms: (
    terms: Partial<Pick<Profile, "startTerm" | "graduationTerm">>,
  ) => void;
  setCreditLimit: (creditLimit: number) => void;
  /** A course sits in one term at most, so adding it again moves it. */
  addToPlan: (term: Term, code: string) => void;
  removeFromPlan: (term: Term, code: string) => void;
  moveInPlan: (code: string, from: Term, to: Term) => void;
  /** Replaces everything, for an imported file that parseProfileFile accepted. */
  loadProfile: (profile: Profile) => void;
  /** Deletes all local data. */
  reset: () => void;
}

export type ProfileState = Profile & ProfileActions;

const initial: Profile = {
  records: [],
  programId: null,
  minorId: null,
  entry: null,
  advancedStanding: 0,
  creditsRequired: null,
  startTerm: null,
  graduationTerm: null,
  plan: [],
  creditLimit: 17,
  importedAt: null,
};

/** The record a transcript line becomes. */
export const recordFromLine = (c: TranscriptCourse): CourseRecord => ({
  code: logicalCode(c.code),
  part: partOf(c.code),
  term: c.term,
  credits: c.credits,
  grade: c.grade,
  status: c.status,
  source: "transcript",
});

const sameTerm = (a: Term | null, b: Term | null) =>
  a === null || b === null ? a === b : termKey(a) === termKey(b);

/** Drops the course from one term, or from every term when none is given. */
function take(plan: Plan, code: string, from?: Term): Plan {
  return plan
    .map((entry) =>
      from && !sameTerm(entry.term, from)
        ? entry
        : { ...entry, courses: entry.courses.filter((c) => c !== code) },
    )
    .filter((entry) => entry.courses.length > 0);
}

function put(plan: Plan, term: Term, code: string): Plan {
  const rest = take(plan, code);
  const entry = rest.find((e) => sameTerm(e.term, term));
  const next = entry
    ? rest.map((e) =>
        e === entry ? { ...e, courses: [...e.courses, code] } : e,
      )
    : [...rest, { term, courses: [code] }];
  return next.sort((a, b) => compareTerms(a.term, b.term));
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get, api) => ({
      ...initial,
      applyTranscript: (transcript, programId) =>
        set((state) => {
          const terms = transcript.courses.flatMap((c) => c.term ?? []);
          const earliest = terms.sort(compareTerms)[0];
          return {
            records: [
              ...state.records.filter((r) => r.source === "manual"),
              ...transcript.courses.map(recordFromLine),
            ],
            programId: programId ?? state.programId,
            entry: isCegep(transcript.previousEducation)
              ? "cegep"
              : state.entry,
            advancedStanding: transcript.advancedStanding,
            creditsRequired:
              transcript.creditsRequired ?? state.creditsRequired,
            startTerm: earliest ?? state.startTerm,
            importedAt: new Date().toISOString(),
          };
        }),
      addCourse: (record) =>
        set((state) => ({
          records: [
            ...state.records.filter(
              (r) =>
                !(
                  r.code === record.code &&
                  r.part === record.part &&
                  sameTerm(r.term, record.term)
                ),
            ),
            { ...record, source: "manual" },
          ],
        })),
      removeCourse: (code, part) =>
        set((state) => ({
          records: state.records.filter(
            (r) => r.code !== code || (part !== undefined && r.part !== part),
          ),
        })),
      setProgram: (programId) => set({ programId }),
      setMinor: (minorId) => set({ minorId }),
      setBackground: (background) => set(background),
      setTerms: (terms) => set(terms),
      setCreditLimit: (creditLimit) => set({ creditLimit }),
      addToPlan: (term, code) =>
        set((state) => ({ plan: put(state.plan, term, code) })),
      removeFromPlan: (term, code) =>
        set((state) => ({ plan: take(state.plan, code, term) })),
      moveInPlan: (code, from, to) => {
        const planned = get().plan.some(
          (e) => sameTerm(e.term, from) && e.courses.includes(code),
        );
        if (planned) set((state) => ({ plan: put(state.plan, to, code) }));
      },
      loadProfile: (profile) => set(profile),
      reset: () => {
        set(initial);
        // Storage is missing when the browser blocks it, and then there is nothing to clear.
        api.persist?.clearStorage();
        forgetRecentCourses();
      },
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: PROFILE_VERSION,
      storage: createJSONStorage(() => storage),
      migrate: (persisted, version) =>
        migrateProfile(persisted, version) as ProfileState,
      merge: (persisted, current) => ({
        ...current,
        ...initial,
        ...(persisted as Partial<Profile> | undefined),
      }),
    },
  ),
);

// Each tab writes its whole profile, so take other tabs' edits and resets before this tab writes again.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === PROFILE_STORAGE_KEY || event.key === null) {
      void useProfileStore.persist.rehydrate();
    }
  });
}

/**
 * False on the server and during hydration, true after. Render nothing profile-specific until it is true.
 * The store reads localStorage as soon as this module loads, so reading it earlier would not match the server HTML.
 */
export function useProfileHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
