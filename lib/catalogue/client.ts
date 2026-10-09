"use client";

import { useSyncExternalStore } from "react";
import type { CourseSummary } from "./types.ts";

export type CatalogueState =
  | { status: "loading" | "error" }
  | { status: "ready"; catalogue: ReadonlyMap<string, CourseSummary> };

const LOADING: CatalogueState = { status: "loading" };

/** Administrative records (REGN) and subjects with a digit, such as FMT4 and CPL2, are not degree courses, so no list shows them. Their course pages still exist. */
const isListed = ({ subject }: CourseSummary) =>
  subject !== "REGN" && !/\d/.test(subject);
let state: CatalogueState = LOADING;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: CatalogueState) {
  state = next;
  for (const listener of listeners) listener();
}

function load() {
  if (loading || state.status === "ready") return;
  loading = true;
  fetch("/catalogue.json")
    .then((response) => {
      if (!response.ok)
        throw new Error(`Catalogue request failed: ${response.status}`);
      return response.json() as Promise<CourseSummary[]>;
    })
    .then((courses) =>
      publish({
        status: "ready",
        catalogue: new Map(
          courses.filter(isListed).map((course) => [course.code, course]),
        ),
      }),
    )
    .catch(() => publish({ status: "error" }))
    .finally(() => {
      loading = false;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
  };
}

/** The catalogue as it is now, for code outside React. It is "loading" until a component asks for it. */
export const catalogueNow = () => state;

/** The compact catalogue, fetched once per page load. It is "loading" on the server and during hydration. */
export function useCatalogue(): CatalogueState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}
