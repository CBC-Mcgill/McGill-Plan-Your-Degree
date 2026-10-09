"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { CatalogueError } from "@/components/catalogue-error";
import { NoProfile } from "@/components/no-profile";
import { PlanSummary } from "@/components/plan/plan-summary";
import { TermPanel } from "@/components/plan/term-panel";
import { TermPath } from "@/components/plan/term-path";
import { Notice } from "@/components/ui/notice";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses } from "@/lib/catalogue/search";
import { planWarnings, termRange } from "@/lib/engine/plan";
import { programStanding } from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { buildStages } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm, termLabel } from "@/lib/profile/term-options";
import { compareTerms, type Term, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import type { Program } from "@/lib/programs/types";

/** The planner. Without a profile it offers to import a transcript or to plan from scratch. */
export function Planner() {
  const snapshot = useSnapshot();

  if (snapshot === undefined) return <PlannerSkeleton />;
  if (snapshot === null) {
    return (
      <NoProfile
        title="Plan every term to graduation"
        lede="Import your unofficial transcript and every course you have taken lands on your path."
      />
    );
  }
  return <PlannerWithCatalogue snapshot={snapshot} />;
}

// Split out so a first-time visitor on the empty state does not download the catalogue.
function PlannerWithCatalogue({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();
  const programId = useProfileStore((state) => state.programId);
  const minorId = useProfileStore((state) => state.minorId);
  const program = useProgram(programId);
  const minor = useProgram(minorId);

  if (catalogue.status === "error") {
    return (
      <>
        <h1 className="sr-only">Planner</h1>
        <CatalogueError />
      </>
    );
  }
  if (
    catalogue.status !== "ready" ||
    program === undefined ||
    minor === undefined
  ) {
    return <PlannerSkeleton />;
  }
  return (
    <PlannerReady
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
      minor={minor}
    />
  );
}

function PlannerReady({
  snapshot,
  catalogue,
  program,
  minor,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  minor: Program | null;
}) {
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const startTerm = useProfileStore((state) => state.startTerm);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const entry = useProfileStore((state) => state.entry);
  const [picked, setPicked] = useState<number | null>(null);

  const now = useMemo(() => currentTerm(), []);
  const nowKey = termKey(now);
  const index = useMemo(() => indexCourses(catalogue.values()), [catalogue]);
  const warnings = useMemo(
    () => planWarnings(plan, snapshot, catalogue, creditLimit, graduationTerm),
    [plan, snapshot, catalogue, creditLimit, graduationTerm],
  );
  const { stages, end } = useMemo(
    () =>
      buildStages({
        records,
        plan,
        startTerm,
        graduationTerm,
        entry,
        catalogue,
        warnings,
        now,
      }),
    [records, plan, startTerm, graduationTerm, entry, catalogue, warnings, now],
  );
  const progress = useMemo(
    () =>
      program
        ? programStanding(program, snapshot, catalogue, entry, "plan")
        : null,
    [program, snapshot, catalogue, entry],
  );
  const minorProgress = useMemo(
    () =>
      minor ? programStanding(minor, snapshot, catalogue, entry, "plan") : null,
    [minor, snapshot, catalogue, entry],
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
  const firstWarned = stages.find((stage) => stage.warnings.length > 0);

  // The panel of the old term is gone after a move, so land on the new one.
  function follow(key: number) {
    flushSync(() => setPicked(key));
    document.getElementById("term-heading")?.focus();
  }

  return (
    <>
      <PlanSummary
        standing={program && progress ? { program, progress } : null}
        minor={
          minor && minorProgress
            ? { program: minor, progress: minorProgress }
            : null
        }
        snapshot={snapshot}
        catalogue={catalogue}
        warningCount={warnings.length}
        onShowWarnings={() => firstWarned && follow(firstWarned.key)}
        graduationPassed={
          graduationTerm && compareTerms(graduationTerm, now) < 0
            ? termLabel(graduationTerm)
            : null
        }
      />
      {selected ? (
        <div className="mt-8 grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-6">
          <TermPath
            stages={stages}
            selected={selected.key}
            onSelect={setPicked}
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
      ) : (
        <div className="mt-12">
          <Notice tone="danger" role="alert">
            Your graduation term is before your start term. Fix them on your
            profile.
          </Notice>
        </div>
      )}
    </>
  );
}

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

function PlannerSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your plan</span>
      <div aria-hidden>
        <div className={`${bone} h-11 w-[560px]`} />
        <div className={`${bone} mt-2 h-5 w-[480px]`} />
        <div className="mt-8 grid grid-cols-[15rem_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-1">
            {Array.from({ length: 6 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={`${bone} h-11`} />
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
