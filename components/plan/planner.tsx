"use client";

import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { CatalogueError } from "@/components/catalogue-error";
import { PlanSummary } from "@/components/plan/plan-summary";
import { TermPanel } from "@/components/plan/term-panel";
import { TermPath } from "@/components/plan/term-path";
import { StatusIcon } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses } from "@/lib/catalogue/search";
import { planWarnings, termRange } from "@/lib/engine/plan";
import { programProgress } from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { buildStages } from "@/lib/engine/stages";
import { startProfile } from "@/lib/profile/started";
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
  if (snapshot === null) return <EmptyState />;
  return <PlannerWithCatalogue snapshot={snapshot} />;
}

// Split out so a first-time visitor on the empty state does not download the catalogue.
function PlannerWithCatalogue({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();
  const programId = useProfileStore((state) => state.programId);
  const program = useProgram(programId);

  if (catalogue.status === "error") {
    return <CatalogueError />;
  }
  if (catalogue.status !== "ready" || program === undefined) {
    return <PlannerSkeleton />;
  }
  return (
    <PlannerReady
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
    />
  );
}

function PlannerReady({
  snapshot,
  catalogue,
  program,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
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
        ? programProgress(program, snapshot, catalogue, {
            inProgress: true,
            planned: true,
            entry,
          })
        : null,
    [program, snapshot, catalogue, entry],
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
        program={program}
        progress={progress}
        warningCount={warnings.length}
        onShowWarnings={() => firstWarned && setPicked(firstWarned.key)}
        graduation={termLabel(end)}
        graduationSet={graduationTerm !== null}
        graduationPassed={
          graduationTerm && compareTerms(graduationTerm, now) < 0
            ? termLabel(graduationTerm)
            : null
        }
      />
      {selected ? (
        <div className="grid grid-cols-[18.75rem_minmax(0,1fr)] items-start gap-6">
          <TermPath
            stages={stages}
            selected={selected.key}
            onSelect={setPicked}
            nowKey={nowKey}
            graduation={{ term: end, satisfied: progress?.satisfied ?? false }}
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
        <p role="alert">
          Your graduation term is before your start term. Fix them on your
          profile.
        </p>
      )}
    </>
  );
}

function EmptyState() {
  // Matches the stages on the path: completed, current, planned, empty, and graduation.
  const steps = ["completed", "in-progress", "planned", "available"] as const;

  return (
    <Card className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-5 px-10 py-12 text-center">
      <div aria-hidden className="flex items-center">
        {steps.map((status) => (
          <div key={status} className="flex items-center">
            <StatusIcon status={status} size={20} />
            <span className="h-0.5 w-8 bg-border-strong" />
          </div>
        ))}
        <span className="grid size-5 place-items-center rounded-full bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border-strong)]">
          <GraduationCap className="size-3" strokeWidth={2} />
        </span>
      </div>
      <div>
        <h2 className="text-lg">Start your path to graduation</h2>
        <p className="mt-1 text-balance text-muted-foreground">
          Import your unofficial transcript and every course you have taken
          lands on your path. It never leaves your browser.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button asChild size="lg">
          <Link href="/profile">Import your transcript</Link>
        </Button>
        <Button variant="secondary" size="lg" onClick={startProfile}>
          Start planning without one
        </Button>
      </div>
    </Card>
  );
}

function PlannerSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Loading your plan</span>
      <Card aria-hidden className="h-24" />
      <div
        aria-hidden
        className="grid grid-cols-[18.75rem_minmax(0,1fr)] gap-6"
      >
        <Card className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            <div key={row} className="flex items-center gap-3">
              <div className="size-4 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="h-4 flex-1 rounded-sm bg-muted motion-safe:animate-pulse" />
            </div>
          ))}
        </Card>
        <Card className="h-96 p-5">
          <div className="h-7 w-48 rounded-sm bg-muted motion-safe:animate-pulse" />
        </Card>
      </div>
    </div>
  );
}
