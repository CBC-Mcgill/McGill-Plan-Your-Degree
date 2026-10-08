"use client";

import { cn } from "cn";
import { ChevronDown, Plus, TriangleAlert, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { CourseLink } from "@/components/course-link";
import { seasonsOffered } from "@/components/course-row";
import { AddCourse } from "@/components/plan/add-course";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { TermWarnings } from "@/components/plan/term-warnings";
import {
  STATUS,
  type Status,
  StatusIcon,
  StatusLabel,
} from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { IndexedCourse } from "@/lib/catalogue/search";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import {
  plannedCredits,
  recordCredits,
  type Stage,
  suggestForTerm,
} from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import type { CourseStatus, Plan, Term } from "@/lib/profile/types";
import { termKey } from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

const MAX_SUGGESTIONS = 5;

/** What a record shows in the grade column when the transcript has no grade for it. */
const WITHOUT_GRADE: Partial<Record<CourseStatus, string>> = {
  failed: "Failed",
  withdrawn: "Withdrawn",
  deferred: "Deferred",
  transfer: "Transfer",
  exemption: "Exempt",
};

const band =
  "flex h-9 items-center gap-2 bg-subtle px-5 font-semibold text-[13px] leading-[18px]";
const list = "divide-y divide-border border-border border-t";
const row = "flex h-11 items-center gap-3 px-5";
const code = "w-20 shrink-0 whitespace-nowrap font-semibold tabular-nums";
const credits =
  "w-12 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums";

export interface MoveOption {
  term: Term;
  credits: number;
}

/** The status glyph of a dense row. The word sits in a tooltip and in the accessible name. */
function RowStatus({ status }: { status: Status }) {
  const { label } = STATUS[status];
  return (
    <span title={label} className="flex">
      <StatusIcon status={status} label={label} />
    </span>
  );
}

function CourseCode({ value }: { value: string }) {
  return (
    <CourseLink
      code={value}
      className={cn(code, "text-foreground no-underline hover:underline")}
    />
  );
}

function Title({
  catalogue,
  value,
  warned,
}: {
  catalogue: Catalogue;
  value: string;
  warned: boolean;
}) {
  const title = catalogue.get(value)?.title ?? "Not in the catalogue";
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate" title={title}>
        {title}
      </span>
      {warned && (
        <TriangleAlert
          aria-label="Has a warning"
          role="img"
          className="size-3.5 shrink-0 text-warn"
          strokeWidth={2}
        />
      )}
    </span>
  );
}

const menuItem =
  "flex h-8 cursor-default select-none items-center gap-3 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-subtle";

/** The terms a planned course can move to, with the credits each already holds. */
function MoveMenu({
  code,
  options,
  onMove,
  onCloseAutoFocus,
}: {
  code: string;
  options: MoveOption[];
  onMove: (to: Term) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move ${code} to another term`}
        >
          Move
          <ChevronDown aria-hidden strokeWidth={1.75} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={16}
          onCloseAutoFocus={onCloseAutoFocus}
          className="z-50 max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-56 overflow-y-auto rounded-lg bg-card p-1 text-foreground antialiased shadow-float"
        >
          <DropdownMenu.Label className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs leading-4">
            Move {code} to
          </DropdownMenu.Label>
          {options.map((option) => (
            <DropdownMenu.Item
              key={termKey(option.term)}
              className={menuItem}
              onSelect={() => onMove(option.term)}
            >
              <span className="flex-1">{termLabel(option.term)}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {option.credits} cr
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The selected term: its courses, an add box and the required courses that fit. Planned courses can move or go. */
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
  /** Every term a planned course can move to. */
  moveOptions: MoveOption[];
}) {
  const entry = useProfileStore((state) => state.entry);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

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
  const records = [...stage.records].sort((a, b) => (a.code < b.code ? -1 : 1));
  const recordTotal = records.reduce(
    (sum, record) => sum + recordCredits(record, catalogue),
    0,
  );
  const plannedTotal = stage.planned.reduce(
    (sum, value) => sum + plannedCredits(catalogue.get(value)),
    0,
  );
  const targets = moveOptions.filter(
    (option) => termKey(option.term) !== stage.key,
  );
  const suggestions =
    !past && program
      ? suggestForTerm(
          program,
          snapshot,
          catalogue,
          plan,
          stage.term,
          entry,
        ).slice(0, MAX_SUGGESTIONS)
      : [];

  // The row a move or remove acted on is gone, so keep keyboard focus inside the panel.
  function move(value: string, to: Term) {
    moved.current = true;
    addWithUndo(to, value);
  }

  function afterMenu(event: Event) {
    if (!moved.current) return;
    moved.current = false;
    event.preventDefault();
    heading.current?.focus();
  }

  function remove(value: string) {
    removeWithUndo(stage.term, value);
    heading.current?.focus();
  }

  return (
    <Card asChild className="divide-y divide-border">
      <section
        role="tabpanel"
        id="term-panel"
        aria-labelledby={`stage-${stage.key}`}
      >
        <header className="flex h-16 items-center gap-4 px-5">
          <h2
            ref={heading}
            tabIndex={-1}
            className="rounded-sm text-base leading-6"
          >
            {label}
          </h2>
          {status && <StatusLabel status={status} />}
          <div className="ml-auto flex items-center gap-3">
            {past ? (
              <>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {stage.credits} credits
                </span>
                <Badge title="This term has passed, so your record is read-only">
                  Read only
                </Badge>
              </>
            ) : (
              <>
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
                  className="w-40"
                />
                <span
                  className={cn(
                    "w-[116px] text-right font-semibold tabular-nums",
                    over && "text-warn",
                  )}
                >
                  {stage.credits} of {creditLimit} credits
                </span>
              </>
            )}
          </div>
        </header>

        {stage.warnings.length > 0 && (
          <div className="p-5">
            <TermWarnings
              warnings={stage.warnings}
              snapshot={snapshot}
              catalogue={catalogue}
              plan={plan}
            />
          </div>
        )}

        {records.length > 0 && (
          <section aria-label="Your courses">
            <div className={band}>
              Your courses
              <span className="font-normal text-muted-foreground tabular-nums">
                {records.length}
              </span>
              <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                {recordTotal} credits
              </span>
            </div>
            <ul className={list}>
              {records.map((record) => (
                <li key={`${record.code}-${record.status}`} className={row}>
                  <RowStatus status={record.status} />
                  <CourseCode value={record.code} />
                  <Title
                    catalogue={catalogue}
                    value={record.code}
                    warned={warned.has(record.code)}
                  />
                  <span className="w-20 shrink-0 text-right font-semibold text-[13px] text-muted-foreground tabular-nums">
                    {record.grade ?? WITHOUT_GRADE[record.status]}
                  </span>
                  <span className={credits}>
                    {recordCredits(record, catalogue)} cr
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(stage.planned.length > 0 || !past) && (
          <section aria-label="Planned courses">
            <div className={band}>
              Planned
              <span className="font-normal text-muted-foreground tabular-nums">
                {stage.planned.length}
              </span>
              {stage.planned.length > 0 && (
                <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                  {plannedTotal} credits
                </span>
              )}
            </div>
            {stage.planned.length === 0 ? (
              <div className="border-border border-t px-5 py-4">
                <p className="font-semibold text-[13px] leading-[18px]">
                  Nothing planned for {label}
                </p>
                <p className="text-[13px] text-muted-foreground leading-[18px]">
                  Add a course from the suggestions or search for one.
                </p>
              </div>
            ) : (
              <ul className={list}>
                {stage.planned.map((value) => (
                  <li key={value} className={cn(row, "group hover:bg-subtle")}>
                    <RowStatus status="planned" />
                    <CourseCode value={value} />
                    <Title
                      catalogue={catalogue}
                      value={value}
                      warned={warned.has(value)}
                    />
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none">
                      <MoveMenu
                        code={value}
                        options={targets}
                        onMove={(to) => move(value, to)}
                        onCloseAutoFocus={afterMenu}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${value} from ${label}`}
                        onClick={() => remove(value)}
                      >
                        <X aria-hidden strokeWidth={1.75} />
                      </Button>
                    </div>
                    <span className={credits}>
                      {plannedCredits(catalogue.get(value))} cr
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {past && records.length === 0 && stage.planned.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">
            Nothing was recorded for this term.
          </p>
        )}

        {!past && (
          <section aria-label="Add a course" className="px-5 py-4">
            <p className="mb-2 font-semibold text-[13px] leading-[18px]">
              Add a course
            </p>
            <AddCourse
              term={stage.term}
              index={index}
              snapshot={snapshot}
              plan={plan}
            />
          </section>
        )}

        {!past && program && (
          <section aria-label={`Suggested for ${label}`}>
            <div className={band}>
              Suggested for {label}
              <span className="ml-auto font-normal text-muted-foreground text-xs">
                Needed by your program, offered in {stage.term.season}
              </span>
            </div>
            {suggestions.length === 0 ? (
              <p className="border-border border-t px-5 py-4 text-[13px] text-muted-foreground">
                No remaining required course fits this term.
              </p>
            ) : (
              <ul className={list}>
                {suggestions.map((course) => (
                  <li key={course.code} className={cn(row, "pr-3")}>
                    <RowStatus status="available" />
                    <CourseCode value={course.code} />
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={course.title}
                    >
                      {course.title}
                    </span>
                    <span className="w-32 shrink-0 text-right text-[13px] text-muted-foreground">
                      {seasonsOffered(course)}
                    </span>
                    <span className={credits}>{course.credits ?? "?"} cr</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Add ${course.code} to ${label}`}
                      onClick={() => addWithUndo(stage.term, course.code)}
                    >
                      <Plus aria-hidden strokeWidth={1.75} />
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </Card>
  );
}
