"use client";

import { cn } from "cn";
import { TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CourseLink } from "@/components/course-link";
import { seasonsOffered } from "@/components/course-row";
import { AddCourse } from "@/components/plan/add-course";
import { TermWarnings } from "@/components/plan/term-warnings";
import { StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress";
import type { IndexedCourse } from "@/lib/catalogue/search";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { recordCredits, type Stage, suggestForTerm } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import {
  type CourseRecord,
  type Plan,
  type Term,
  termFromKey,
  termKey,
} from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

function Title({ code, catalogue }: { code: string; catalogue: Catalogue }) {
  const course = catalogue.get(code);
  return (
    <p className="truncate">
      <CourseLink code={code} className="font-semibold" />{" "}
      <span title={course?.title}>{course?.title}</span>
    </p>
  );
}

const list = "divide-y divide-border overflow-hidden";

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
  const entry = useProfileStore((state) => state.entry);
  const [notice, setNotice] = useState("");

  const label = termLabel(stage.term);
  const past = stage.key < termKey(now);
  const over = stage.credits > creditLimit;
  const status =
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
      ? suggestForTerm(program, snapshot, catalogue, plan, stage.term, entry)
      : null;

  return (
    <Card asChild className="p-5">
      <motion.section
        role="tabpanel"
        id="term-panel"
        aria-labelledby={`stage-${stage.key}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-5"
      >
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg">{label}</h2>
            {status && <StatusLabel status={status} />}
          </div>
          {past ? (
            <p className="font-medium">
              {stage.credits} credits{" "}
              <span className="font-normal text-muted-foreground">
                · this term has passed, so your record is read-only
              </span>
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <ProgressBar
                value={Math.min(stage.credits, creditLimit)}
                max={creditLimit}
                label={`Credits in ${label}`}
                valueText={`${stage.credits} of ${creditLimit} credits`}
                fill={
                  over
                    ? "warn"
                    : stage.state === "current"
                      ? "in-progress"
                      : "planned"
                }
                className="flex-1"
              />
              <p
                className={cn(
                  "whitespace-nowrap font-semibold tabular-nums",
                  over && "text-warn",
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
            <h3 id="records-heading" className="mb-2 text-sm">
              Your courses
            </h3>
            <Card asChild className={list}>
              <ul>
                {[...stage.records]
                  .sort((a, b) => (a.code < b.code ? -1 : 1))
                  .map((record: CourseRecord) => (
                    <li
                      key={`${record.code}-${record.status}`}
                      className="grid grid-cols-[minmax(0,1fr)_2rem_9rem] items-center gap-4 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <Title code={record.code} catalogue={catalogue} />
                        <p className="text-[13px] text-muted-foreground">
                          {recordCredits(record, catalogue)} credits
                        </p>
                      </div>
                      <p className="text-center font-semibold">
                        {record.grade ?? ""}
                      </p>
                      <StatusLabel
                        status={record.status}
                        className="justify-self-start"
                      />
                    </li>
                  ))}
              </ul>
            </Card>
          </section>
        )}

        {(stage.planned.length > 0 || !past) && (
          <section aria-labelledby="planned-heading">
            <h3 id="planned-heading" className="mb-2 text-sm">
              Planned courses
            </h3>
            {stage.planned.length === 0 ? (
              <p className="text-muted-foreground">
                Nothing planned for {label} yet. Search for a course below
                {program ? " or pick a suggestion" : ""}.
              </p>
            ) : (
              <Card asChild className={list}>
                <ul>
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
                          className="flex items-center gap-3 px-4 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <Title code={code} catalogue={catalogue} />
                            <p className="text-[13px] text-muted-foreground">
                              {course
                                ? `${course.credits ?? "-"} credits · ${seasonsOffered(course)}`
                                : "Not in the catalogue"}
                            </p>
                          </div>
                          {warned.has(code) && (
                            <TriangleAlert
                              aria-label="Has a warning"
                              role="img"
                              className="size-4 shrink-0 text-warn"
                            />
                          )}
                          <SelectField
                            compact
                            label={`Move ${code} to another term`}
                            value=""
                            onChange={(event) => {
                              const to = termFromKey(
                                Number(event.target.value),
                              );
                              moveInPlan(code, stage.term, to);
                              setNotice(`Moved ${code} to ${termLabel(to)}.`);
                            }}
                            className="w-36 shrink-0"
                          >
                            <option value="" disabled>
                              Move to...
                            </option>
                            {destinations.map((t) => (
                              <option key={termKey(t)} value={termKey(t)}>
                                {termLabel(t)}
                              </option>
                            ))}
                          </SelectField>
                          <Button
                            variant="secondary"
                            aria-label={`Remove ${code} from ${label}`}
                            onClick={() => {
                              removeFromPlan(stage.term, code);
                              setNotice(`Removed ${code} from ${label}.`);
                            }}
                          >
                            <X aria-hidden />
                            Remove
                          </Button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </Card>
            )}
            <p
              role="status"
              className="mt-2 text-[13px] text-muted-foreground empty:mt-0"
            >
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
    </Card>
  );
}
