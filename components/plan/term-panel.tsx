"use client";

import { cn } from "cn";
import { TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CourseLink } from "@/components/course-link";
import { seasonsOffered } from "@/components/course-row";
import { AddCourse } from "@/components/plan/add-course";
import { TermWarnings } from "@/components/plan/term-warnings";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { IndexedCourse } from "@/lib/catalogue/search";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { recordCredits, type Stage, suggestForTerm } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import {
  type CourseRecord,
  type CourseStatus,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

const OTHER_STATUS: Partial<Record<CourseStatus, string>> = {
  failed: "Failed",
  withdrawn: "Withdrawn",
  deferred: "Deferred",
  transfer: "Transfer credit",
  exemption: "Exemption",
};

function RecordChip({ status }: { status: CourseStatus }) {
  if (status === "completed" || status === "in-progress") {
    return <StatusChip status={status} className="justify-self-start" />;
  }
  return (
    <span className="inline-flex h-7 items-center justify-self-start whitespace-nowrap rounded-sm border border-locked/30 bg-locked-surface px-2.5 font-semibold text-locked text-xs">
      {OTHER_STATUS[status]}
    </span>
  );
}

function Title({ code, catalogue }: { code: string; catalogue: Catalogue }) {
  const course = catalogue.get(code);
  return (
    <p className="truncate">
      <CourseLink code={code} className="font-extrabold" />{" "}
      <span title={course?.title}>{course?.title}</span>
    </p>
  );
}

const list = "divide-y divide-border rounded-lg border-2 border-border bg-card";

export function TermPanel({
  stage,
  now,
  snapshot,
  catalogue,
  index,
  program,
  plan,
  creditLimit,
  moveOptions,
}: {
  stage: Stage;
  now: Term;
  snapshot: Snapshot;
  catalogue: Catalogue;
  index: readonly IndexedCourse[];
  program: Program | null;
  plan: Plan;
  creditLimit: number;
  /** Terms a planned course can move to. */
  moveOptions: Term[];
}) {
  const removeFromPlan = useProfileStore((state) => state.removeFromPlan);
  const moveInPlan = useProfileStore((state) => state.moveInPlan);
  const [notice, setNotice] = useState("");

  const label = termLabel(stage.term);
  const past = stage.key < termKey(now);
  const over = stage.credits > creditLimit;
  const chip =
    stage.state === "completed"
      ? "completed"
      : stage.state === "current"
        ? "in-progress"
        : stage.state === "planned"
          ? "planned"
          : null;
  const warned = new Set(
    stage.warnings.flatMap((w) => ("course" in w ? w.course : [])),
  );
  const destinations = moveOptions.filter((t) => termKey(t) !== stage.key);
  const suggestions =
    !past && program
      ? suggestForTerm(program, snapshot, catalogue, plan, stage.term)
      : null;

  return (
    <motion.section
      role="tabpanel"
      id="term-panel"
      aria-labelledby={`stage-${stage.key}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-6 rounded-lg border-2 border-border bg-card p-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-3xl">{label}</h2>
          {chip && <StatusChip status={chip} className="h-9 px-3 text-sm" />}
        </div>
        {past ? (
          <p className="font-semibold">
            {stage.credits} credits{" "}
            <span className="font-normal text-muted-foreground">
              - this term has passed, so your record is read-only
            </span>
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <Progress
              value={Math.min(stage.credits, creditLimit)}
              max={creditLimit}
              aria-label={`Credits in ${label}`}
              aria-valuetext={`${stage.credits} of ${creditLimit} credits`}
              className={cn(
                "flex-1",
                over
                  ? "text-primary"
                  : stage.state === "current"
                    ? "text-in-progress"
                    : "text-planned",
              )}
            />
            <p
              className={cn(
                "whitespace-nowrap font-semibold tabular-nums",
                over && "text-primary-edge",
              )}
            >
              {stage.credits} of {creditLimit} credits
            </p>
          </div>
        )}
      </header>

      <TermWarnings
        warnings={stage.warnings}
        snapshot={snapshot}
        catalogue={catalogue}
        plan={plan}
      />

      {stage.records.length > 0 && (
        <section aria-labelledby="records-heading">
          <h3 id="records-heading" className="mb-2 text-base">
            Your courses
          </h3>
          <ul className={list}>
            {[...stage.records]
              .sort((a, b) => (a.code < b.code ? -1 : 1))
              .map((record: CourseRecord) => (
                <li
                  key={`${record.code}-${record.status}`}
                  className="grid grid-cols-[minmax(0,1fr)_2rem_7.5rem] items-center gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <Title code={record.code} catalogue={catalogue} />
                    <p className="text-muted-foreground text-sm">
                      {recordCredits(record, catalogue)} credits
                    </p>
                  </div>
                  <p className="text-center font-extrabold">
                    {record.grade ?? ""}
                  </p>
                  <RecordChip status={record.status} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {(stage.planned.length > 0 || !past) && (
        <section aria-labelledby="planned-heading">
          <h3 id="planned-heading" className="mb-2 text-base">
            Planned courses
          </h3>
          {stage.planned.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing planned for {label} yet. Search for a course below
              {program ? " or pick a suggestion" : ""}.
            </p>
          ) : (
            <ul className={list}>
              <AnimatePresence initial={false}>
                {stage.planned.map((code) => {
                  const course = catalogue.get(code);
                  return (
                    <motion.li
                      key={code}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <Title code={code} catalogue={catalogue} />
                        <p className="text-muted-foreground text-sm">
                          {course
                            ? `${course.credits ?? "-"} credits - ${seasonsOffered(course)}`
                            : "Not in the catalogue"}
                        </p>
                      </div>
                      {warned.has(code) && (
                        <TriangleAlert
                          aria-label="Has a warning"
                          role="img"
                          className="size-5 shrink-0 text-primary-edge"
                        />
                      )}
                      <select
                        aria-label={`Move ${code} to another term`}
                        value=""
                        onChange={(event) => {
                          const to = termFromKey(Number(event.target.value));
                          moveInPlan(code, stage.term, to);
                          setNotice(`Moved ${code} to ${termLabel(to)}.`);
                        }}
                        className="h-10 w-36 shrink-0 rounded-md border-2 border-border-strong bg-card px-2 text-sm"
                      >
                        <option value="" disabled>
                          Move to...
                        </option>
                        {destinations.map((t) => (
                          <option key={termKey(t)} value={termKey(t)}>
                            {termLabel(t)}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        className="h-10 px-3 text-sm shadow-none active:translate-y-0"
                        aria-label={`Remove ${code} from ${label}`}
                        onClick={() => {
                          removeFromPlan(stage.term, code);
                          setNotice(`Removed ${code} from ${label}.`);
                        }}
                      >
                        <X aria-hidden className="size-4!" />
                        Remove
                      </Button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
          <p role="status" className="mt-2 text-sm empty:mt-0">
            {notice}
          </p>
        </section>
      )}

      {past && stage.records.length === 0 && stage.planned.length === 0 && (
        <p className="text-muted-foreground">
          Nothing was recorded for this term.
        </p>
      )}

      {!past && (
        <AddCourse
          term={stage.term}
          index={index}
          snapshot={snapshot}
          suggestions={suggestions}
          hasProgram={program !== null}
        />
      )}
    </motion.section>
  );
}
