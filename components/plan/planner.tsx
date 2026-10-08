"use client";

import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PlanSummary } from "@/components/plan/plan-summary";
import { QuestPath } from "@/components/plan/quest-path";
import { TermPanel } from "@/components/plan/term-panel";
import { StatusIcon } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses } from "@/lib/catalogue/search";
import { planWarnings, termRange } from "@/lib/engine/plan";
import { programProgress } from "@/lib/engine/progress";
import {
  buildSnapshot,
  type Catalogue,
  type Snapshot,
} from "@/lib/engine/snapshot";
import { buildStages } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  defaultGraduation,
  termLabel,
} from "@/lib/profile/term-options";
import { compareTerms, type Term, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { getProgram } from "@/lib/programs";

const NOTHING = buildSnapshot([]);

/** The planner. Without a profile it offers to import a transcript or to plan from scratch. */
export function Planner() {
  const snapshot = useSnapshot();
  const startTerm = useProfileStore((state) => state.startTerm);

  if (snapshot === undefined) return <PlannerSkeleton />;
  if (snapshot === null && startTerm === null) return <EmptyState />;
  return <PlannerWithCatalogue snapshot={snapshot ?? NOTHING} />;
}

// Split out so a first-time visitor on the empty state does not download the catalogue.
function PlannerWithCatalogue({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();

  if (catalogue.status === "error") {
    return (
      <p role="alert" className="mt-6">
        Could not load the course list. Reload the page to try again.
      </p>
    );
  }
  if (catalogue.status !== "ready") return <PlannerSkeleton />;
  return <PlannerReady snapshot={snapshot} catalogue={catalogue.catalogue} />;
}

function PlannerReady({
  snapshot,
  catalogue,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
}) {
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const programId = useProfileStore((state) => state.programId);
  const startTerm = useProfileStore((state) => state.startTerm);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const entry = useProfileStore((state) => state.entry);
  const [picked, setPicked] = useState<number | null>(null);

  const now = useMemo(() => currentTerm(), []);
  const nowKey = termKey(now);
  const program = programId ? (getProgram(programId) ?? null) : null;
  const index = useMemo(() => indexCourses(catalogue.values()), [catalogue]);
  const warnings = useMemo(
    () => planWarnings(plan, snapshot, catalogue, creditLimit),
    [plan, snapshot, catalogue, creditLimit],
  );
  const { stages, end } = useMemo(
    () =>
      buildStages({
        records,
        plan,
        startTerm,
        graduationTerm,
        catalogue,
        warnings,
        now,
      }),
    [records, plan, startTerm, graduationTerm, catalogue, warnings, now],
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
      ...stages.filter((stage) => stage.key >= nowKey).map((s) => s.term),
    ]) {
      terms.set(termKey(term), term);
    }
    return [...terms.values()].sort(compareTerms);
  }, [stages, now, nowKey, end]);

  const selected =
    stages.find((stage) => stage.key === picked) ??
    stages.find((stage) => stage.key >= nowKey) ??
    stages.at(-1);
  const firstWarned = stages.find((stage) => stage.warnings.length > 0);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <PlanSummary
        program={program}
        progress={progress}
        warningCount={warnings.length}
        onShowWarnings={() => firstWarned && setPicked(firstWarned.key)}
        graduationSet={graduationTerm !== null}
        graduationPassed={
          graduationTerm && compareTerms(graduationTerm, now) < 0
            ? termLabel(graduationTerm)
            : null
        }
      />
      {selected ? (
        <div className="grid grid-cols-[18.75rem_minmax(0,1fr)] items-start gap-6">
          <QuestPath
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
          />
        </div>
      ) : (
        <p role="alert">
          Your graduation term is before your start term. Fix them on your
          profile.
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  const setTerms = useProfileStore((state) => state.setTerms);
  // Matches the stages on the path: completed, current, planned, empty, and graduation.
  const steps = ["completed", "in-progress", "planned", "available"] as const;

  return (
    <Card className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-5 px-10 py-12 text-center">
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
        <p className="mt-1 text-muted-foreground">
          Import your unofficial transcript and every course you have taken
          lands on your path. It never leaves your browser.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button asChild size="lg">
          <Link href="/profile">Import your transcript</Link>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            const start = currentTerm();
            setTerms({
              startTerm: start,
              graduationTerm: defaultGraduation(start),
            });
          }}
        >
          Start planning without one
        </Button>
      </div>
    </Card>
  );
}

function PlannerSkeleton() {
  return (
    <div role="status" className="mt-6 flex flex-col gap-6">
      <span className="sr-only">Loading your plan</span>
      <Card aria-hidden className="h-36" />
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
