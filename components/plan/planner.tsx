"use client";

import { cn } from "cn";
import { useMemo } from "react";
import { flushSync } from "react-dom";
import { TermPanel } from "@/components/plan/term-panel";
import { TermPath } from "@/components/plan/term-path";
import { Notice } from "@/components/ui/notice";
import { indexCourses } from "@/lib/catalogue/search";
import { type PlanWarning, termRange } from "@/lib/engine/plan";
import type { ProgramProgress } from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { buildStages } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm } from "@/lib/profile/term-options";
import { compareTerms, type Term, termKey } from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

/** The path of terms beside the selected term's card. */
export function Terms({
  snapshot,
  catalogue,
  program,
  progress,
  warnings,
  picked,
  onPick,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  progress: ProgramProgress | null;
  warnings: readonly PlanWarning[];
  /** The term the student opened, by key. */
  picked: number | null;
  onPick: (key: number) => void;
}) {
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const startTerm = useProfileStore((state) => state.startTerm);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const entry = useProfileStore((state) => state.entry);

  const now = useMemo(() => currentTerm(), []);
  const nowKey = termKey(now);
  const index = useMemo(() => indexCourses(catalogue.values()), [catalogue]);
  const { stages, end } = useMemo(
    () =>
      buildStages({
        records,
        plan,
        startTerm,
        graduationTerm,
        entry,
        program,
        catalogue,
        warnings,
        now,
      }),
    [
      records,
      plan,
      startTerm,
      graduationTerm,
      entry,
      program,
      catalogue,
      warnings,
      now,
    ],
  );
  const moveOptions = useMemo(() => {
    const first = stages[0]?.term ?? now;
    const terms = new Map<number, Term>();
    for (const term of [
      ...termRange(compareTerms(first, now) > 0 ? first : now, end, true),
      ...stages.map((stage) => stage.term),
    ]) {
      terms.set(termKey(term), term);
    }
    return [...terms.values()]
      .filter((term) => termKey(term) > nowKey)
      .sort(compareTerms)
      .map((term) => ({
        term,
        credits:
          stages.find((stage) => stage.key === termKey(term))?.credits ?? 0,
      }));
  }, [stages, now, nowKey, end]);

  // Open on the next term to plan, not the one already in progress.
  const selected =
    stages.find((stage) => stage.key === picked) ??
    stages.find((stage) => stage.key > nowKey) ??
    stages.at(-1);

  // The panel of the old term is gone after a move, so land on the new one.
  function follow(key: number) {
    flushSync(() => onPick(key));
    document.getElementById("term-heading")?.focus();
  }

  if (!selected) {
    return (
      <Notice tone="danger" role="alert">
        Your graduation term is before your start term. Fix them on your
        profile.
      </Notice>
    );
  }
  return (
    <div className={GRID}>
      <TermPath
        stages={stages}
        selected={selected.key}
        onSelect={onPick}
        nowKey={nowKey}
        graduation={{
          term: end,
          set: graduationTerm !== null,
          satisfied: progress?.satisfied ?? false,
        }}
      />
      <TermPanel
        key={selected.key}
        stage={selected}
        now={now}
        snapshot={snapshot}
        catalogue={catalogue}
        index={index}
        program={program}
        plan={plan}
        creditLimit={creditLimit}
        moveOptions={moveOptions}
        onSelect={follow}
      />
    </div>
  );
}

/** The path beside the term card, and above it below 1024px. */
const GRID =
  "grid grid-cols-[16.5rem_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-4 xl:grid-cols-[18.75rem_minmax(0,1fr)]";

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

/** The header, the view switch and the path while the catalogue loads. */
export function PlanSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your plan</span>
      <div aria-hidden>
        <div className={`${bone} h-11 w-[400px] max-md:w-full`} />
        <div className={`${bone} mt-2 h-5 w-[480px] max-md:w-2/3`} />
        <div className={`${bone} mt-6 h-9 w-56 max-md:h-11 max-md:w-full`} />
        <div className={cn(GRID, "mt-6")}>
          <div className="flex flex-col gap-1 max-lg:flex-row max-lg:overflow-hidden">
            {Array.from({ length: 6 }, (_, row) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
                key={row}
                className={`${bone} h-11 max-lg:h-17 max-lg:w-36 max-lg:shrink-0`}
              />
            ))}
          </div>
          <div>
            <div className={`${bone} h-7 w-40`} />
            <div className={`${bone} mt-4 h-11`} />
            <div className={`${bone} mt-6 h-9`} />
          </div>
        </div>
      </div>
    </div>
  );
}
