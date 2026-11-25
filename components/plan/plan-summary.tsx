"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { CatalogueLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { GraduationEdit } from "@/components/plan/graduation-edit";
import { ProgramBars, RoomLeft } from "@/components/program-bars";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Term } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import { requirementSplit, requirementsMet } from "@/lib/engine/credits";
import { list } from "@/lib/engine/parts";
import {
  type ProgramProgress,
  programSplit,
  splitCourses,
} from "@/lib/engine/progress";
import type { Snapshot } from "@/lib/engine/snapshot";
import { GLOSSARY } from "@/lib/glossary";
import { pairOf } from "@/lib/programs/minor";
import type { Program } from "@/lib/programs/types";

interface Standing {
  program: Program;
  progress: ProgramProgress;
}

/** The plan's header, shared by both views: the program, its credits with the plan, second programs and warnings. */
export function PlanSummary({
  standing,
  seconds,
  snapshot,
  warningCount,
  onShowWarnings,
  graduationPassed,
}: {
  standing: Standing | null;
  /** The second program, then the extra minor. */
  seconds: readonly Standing[];
  snapshot: Snapshot;
  warningCount: number;
  onShowWarnings: () => void;
  /** The graduation term's label when it is already in the past. */
  graduationPassed: string | null;
}) {
  const warnings = warningCount > 0 && (
    <p className="shrink-0 font-semibold text-warn">
      <TriangleAlert aria-hidden className="mr-2 inline size-4 align-[-3px]" />
      <Term
        def={{ ...GLOSSARY.warnings, label: COPY.warnings(warningCount) }}
      />
      {" · "}
      <button
        type="button"
        onClick={onShowWarnings}
        className="rounded-md underline decoration-1 underline-offset-3 max-lg:relative max-lg:after:absolute max-lg:after:-inset-x-2 max-lg:after:-inset-y-3"
      >
        Show
      </button>
    </p>
  );
  const [second] = seconds;
  const pair = pairOf(standing?.program ?? null, second?.program ?? null);
  const all = standing ? [standing, ...seconds] : [];
  const hasChecks = (progress: ProgramProgress) =>
    progress.groups.some((group) => group.unparsed > 0);
  const met = all.length > 0 && all.every(({ progress }) => progress.satisfied);
  // A doctorate gives no credit total, so it counts requirements met.
  const byRequirements = standing?.progress.credits === 0;
  const [done, needed] = standing ? requirementsMet(standing.progress) : [0, 0];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-8 max-md:flex-col max-md:gap-2">
        {standing ? (
          <h1>{standing.program.name}</h1>
        ) : (
          <div>
            <h1>Plan</h1>
            <p className="mt-2 text-fg-muted">
              Your program decides which courses you still need.
            </p>
            <Button asChild className="mt-4 max-md:h-11 max-md:w-full">
              <Link href="/profile#program">{COPY.pickProgram}</Link>
            </Button>
          </div>
        )}
        {warnings}
      </div>
      {standing && (
        <>
          <p className="mt-2 text-fg-muted tabular-nums">
            {byRequirements ? (
              <>
                {done} of {needed} <Term def={GLOSSARY.requirementsMet} />
              </>
            ) : (
              `${standing.progress.creditsDone} of ${standing.progress.credits} program credits`
            )}{" "}
            <Term def={GLOSSARY.withPlan} />
            {" · "}
            <CatalogueLink href={standing.program.source} />
            {standing.program.generated && (
              <>
                {" · "}
                <GeneratedNote hasChecks={hasChecks(standing.progress)} />
              </>
            )}
          </p>
          <div className="mt-4">
            <ProgramBars
              program={
                byRequirements
                  ? {
                      label: standing.program.name,
                      done,
                      split: requirementSplit(standing.progress, snapshot),
                      total: needed,
                      requirements: true,
                    }
                  : {
                      label: COPY.pair[pair].labels[0],
                      done: standing.progress.creditsDone,
                      split: programSplit(standing.progress, snapshot),
                      total: standing.progress.credits,
                      courses: splitCourses(standing.progress.groups, snapshot),
                    }
              }
              seconds={seconds.map(({ program, progress }) => ({
                label: COPY.secondTitle(program),
                done: progress.creditsDone,
                split: programSplit(progress, snapshot),
                total: progress.credits,
                courses: splitCourses(progress.groups, snapshot),
                note: program.generated && (
                  <>
                    <GeneratedNote hasChecks={hasChecks(progress)} />{" "}
                    <span className="whitespace-nowrap">
                      · <CatalogueLink href={program.source} />
                    </span>
                  </>
                ),
              }))}
            />
          </div>
        </>
      )}

      <div className="mt-2 flex flex-col gap-1 empty:hidden">
        {standing && <RoomLeft progress={standing.progress} />}
        {graduationPassed && (
          <Notice tone="warn">
            Your expected graduation, {graduationPassed}, has passed.{" "}
            <GraduationEdit>Change it</GraduationEdit>.
          </Notice>
        )}
        {met && (
          <p>
            Your plan meets every requirement of{" "}
            {list.format(
              all.map(({ program }, i) =>
                i === 0 ? program.name : COPY.secondTitle(program),
              ),
            )}
            .
          </p>
        )}
      </div>
    </div>
  );
}
