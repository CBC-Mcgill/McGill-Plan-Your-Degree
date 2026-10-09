"use client";

import { useSyncExternalStore } from "react";
import type { Program, ProgramSummary } from "./types.ts";

export type ProgramIndexState =
  | { status: "loading" | "error" }
  | { status: "ready"; programs: ProgramSummary[] };

const LOADING: ProgramIndexState = { status: "loading" };

/** Null is a program that does not exist or could not be fetched. */
const programs = new Map<string, Program | null>();
const requested = new Set<string>();
let index: ProgramIndexState = LOADING;
let indexRequested = false;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function loadProgram(id: string) {
  if (requested.has(id)) return;
  requested.add(id);
  fetch(`/programs/${id}`)
    .then((response) =>
      response.ok ? (response.json() as Promise<Program>) : null,
    )
    .catch(() => null)
    .then((program) => {
      programs.set(id, program);
      publish();
    });
}

function loadIndex() {
  if (indexRequested) return;
  indexRequested = true;
  fetch("/programs.json")
    .then((response) => {
      if (!response.ok)
        throw new Error(`Program list failed: ${response.status}`);
      return response.json() as Promise<ProgramSummary[]>;
    })
    .then((list): ProgramIndexState => ({ status: "ready", programs: list }))
    .catch((): ProgramIndexState => ({ status: "error" }))
    .then((next) => {
      index = next;
      publish();
    });
}

/** A program with its requirements, fetched once per page load. It is undefined while loading and null when the id is empty or unknown. */
export function useProgram(
  programId: string | null,
): Program | null | undefined {
  return useSyncExternalStore(
    (listener) => {
      const unsubscribe = subscribe(listener);
      if (programId) loadProgram(programId);
      return unsubscribe;
    },
    () => (programId ? programs.get(programId) : null),
    () => (programId ? undefined : null),
  );
}

/** Every program's name, degree and faculty, fetched when the first component asks for it. */
export function useProgramIndex(): ProgramIndexState {
  return useSyncExternalStore(
    (listener) => {
      const unsubscribe = subscribe(listener);
      loadIndex();
      return unsubscribe;
    },
    () => index,
    () => LOADING,
  );
}
