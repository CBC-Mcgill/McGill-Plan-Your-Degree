"use client";

import { cn } from "cn";
import { ChevronDown, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import {
  ROW,
  ROW_LINK,
  ROW_TITLE,
  seasonsOffered,
} from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import { AddCourse } from "@/components/plan/add-course";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { TermWarnings } from "@/components/plan/term-warnings";
import { StatusBadge, UncertainFlag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { BAND, CARD } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { IndexedCourse } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { creditNote } from "@/lib/engine/parts";
import {
  courseLoads,
  loadsName,
  loadsTerms,
  type PlannedLoad,
} from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import {
  owedCredits,
  recordCredits,
  type Stage,
  suggestForTerm,
} from "@/lib/engine/stages";
import { isOffered, isUncertain } from "@/lib/engine/status";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import type { Plan, Term } from "@/lib/profile/types";
import { recordLabel, termKey } from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

const MAX_SUGGESTIONS = 5;

export interface MoveOption {
  term: Term;
  credits: number;
  /** What the menu says when it is not the term alone, such as "Fall 2027 and Winter 2028". */
  label?: string;
}

/**
 * A course row with the same columns as `CourseRow`, for what a term holds: a part code like ECSE 458D1, a record's credits, or a course the catalogue lacks.
 * `action` shows on hover and focus within the row. Pass `action={null}` to keep its column so rows line up.
 */
function Row({
  code,
  label = code,
  title,
  uncertain = false,
  note,
  meta,
  credits,
  tip,
  action,
}: {
  code: string;
  label?: string;
  /** Missing when the catalogue has no such course, so the row does not link. */
  title: string | undefined;
  uncertain?: boolean;
  note?: string;
  meta?: ReactNode;
  credits: ReactNode;
  tip?: string;
  action?: ReactNode;
}) {
  const body = (
    <>
      <span className="w-24 shrink-0 font-semibold tabular-nums">{label}</span>
      <span className="min-w-0">
        <span
          className={title ? "block truncate" : "block text-fg-muted"}
          title={title}
        >
          {title ?? "Not in the catalogue"}
        </span>
        {note && <span className="block text-fg-muted">{note}</span>}
      </span>
    </>
  );
  const link = title ? (
    <Link
      href={`/courses/${courseSlug(code)}`}
      prefetch={false}
      className={ROW_LINK}
    >
      {body}
    </Link>
  ) : (
    <span className="flex min-w-0 gap-4">{body}</span>
  );
  return (
    <li className={ROW}>
      <span className={ROW_TITLE}>
        {tip ? <Tooltip content={tip}>{link}</Tooltip> : link}
        {uncertain && <UncertainFlag />}
      </span>
      {meta && <span className="max-w-80 flex-none text-fg-muted">{meta}</span>}
      <span className="w-24 shrink-0 whitespace-nowrap text-right text-fg-muted tabular-nums">
        {credits}
      </span>
      {action !== undefined && (
        <span className="-my-2 flex w-32 shrink-0 justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
          {action}
        </span>
      )}
    </li>
  );
}

/** Where a part of a multi-term course sits among the others. */
function partCaption(load: PlannedLoad): string | undefined {
  if (load.parts < 2) return undefined;
  const of = `Part ${load.part} of ${load.parts}`;
  if (load.previous) {
    return `${of}, after ${load.previous.label} in ${termLabel(load.previous.term)}`;
  }
  return load.next
    ? `${of}, ${load.next.label} follows in ${termLabel(load.next.term)}`
    : of;
}

/** The terms a planned course can move to, with the credits each already holds and a tag when the course does not run in that season. */
function MoveMenu({
  name,
  course,
  options,
  onMove,
}: {
  name: string;
  course: CourseSummary | undefined;
  options: MoveOption[];
  onMove: (to: Term) => void;
}) {
  return (
    <Menu
      align="end"
      trigger={
        <Button variant="secondary" aria-label={`Move ${name} to another term`}>
          Move
          <ChevronDown aria-hidden />
        </Button>
      }
    >
      {options.map((option) => (
        <MenuItem
          key={termKey(option.term)}
          onSelect={() => onMove(option.term)}
          meta={
            <>
              {course &&
                !course.parts?.length &&
                !isOffered(course, option.term.season) && (
                  <span>{COPY.notOffered}</span>
                )}
              <span>{COPY.termCredits(option.credits)}</span>
            </>
          }
        >
          {option.label ?? termLabel(option.term)}
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The "17" of "3 of 17 credits": a popover that edits the credit limit (pattern C). */
function CreditLimit({ limit }: { limit: number }) {
  const setCreditLimit = useProfileStore((state) => state.setCreditLimit);
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${GLOSSARY.creditLimit.label}, ${limit}`}
          className="rounded-md underline decoration-1 decoration-fg-subtle underline-offset-3 hover:decoration-current"
        >
          {limit}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-[85] w-64 rounded-lg bg-bg p-4 text-fg shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("limit");
              setCreditLimit(Number(value));
              setOpen(false);
            }}
          >
            <TextField
              label={GLOSSARY.creditLimit.label}
              hint={GLOSSARY.creditLimit.tip}
              name="limit"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              step={1}
              required
              defaultValue={limit}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="submit" variant="secondary" className="self-end">
              Save
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The selected term: its warnings, courses, an add box and the required courses that fit. Planned courses can move or go. */
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
  onSelect,
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
  /** Opens another term's panel and moves focus into it. */
  onSelect: (key: number) => void;
}) {
  const entry = useProfileStore((state) => state.entry);
  const heading = useRef<HTMLHeadingElement>(null);

  const label = termLabel(stage.term);
  // Only terms after the current one take new courses.
  const open = stage.key > termKey(now);
  const over = stage.credits > creditLimit;
  const records = [...stage.records].sort((a, b) =>
    recordLabel(a) < recordLabel(b) ? -1 : 1,
  );
  // Grades get their own column so the status words line up.
  const graded = records.some((record) => record.grade);
  // Rows keep an action column whenever some row in the term has actions, so the credits line up.
  const actions = open || stage.planned.length > 0;
  const targets = moveOptions.filter(
    (option) => termKey(option.term) !== stage.key,
  );
  // A multi-term course moves as a whole, so its targets are the terms its first part can start in.
  const targetsFor = (load: PlannedLoad, course: CourseSummary | undefined) =>
    course?.parts?.length
      ? moveOptions
          .filter(
            (option) =>
              termKey(option.term) !== termKey(load.start) &&
              isOffered(course, option.term.season),
          )
          .map((option) => ({
            ...option,
            label: loadsTerms(courseLoads(load.code, course, option.term)),
          }))
      : targets;
  const suggestions =
    open && program
      ? suggestForTerm(
          program,
          snapshot,
          catalogue,
          plan,
          stage.term,
          entry,
        ).slice(0, MAX_SUGGESTIONS)
      : [];
  const empty = records.length + stage.planned.length + stage.owed.length === 0;

  // The row a move or remove acted on is gone, so keep keyboard focus inside the panel, and follow the course back on Undo.
  function move(value: string, to: Term) {
    addWithUndo(to, value, (from) => onSelect(termKey(from)));
    onSelect(termKey(to));
  }

  function remove(load: PlannedLoad) {
    removeWithUndo(load.start, load.code);
    heading.current?.focus();
  }

  return (
    <section
      role="tabpanel"
      id="term-panel"
      aria-labelledby={`stage-${stage.key}`}
      className={CARD}
    >
      <header className={cn(BAND, "justify-between")}>
        <h2
          ref={heading}
          id="term-heading"
          tabIndex={-1}
          className="rounded-md"
        >
          {label}
        </h2>
        {open ? (
          <p className={over ? "text-warn tabular-nums" : "tabular-nums"}>
            {over && (
              <TriangleAlert
                aria-hidden
                className="mr-2 inline size-4 align-[-3px]"
              />
            )}
            {stage.credits} of <CreditLimit limit={creditLimit} /> credits
            {over && ", over your limit"}
          </p>
        ) : (
          <p className="text-fg-muted tabular-nums">
            {COPY.credits(stage.credits)}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 py-4">
        {stage.warnings.length > 0 && (
          <TermWarnings
            warnings={stage.warnings}
            snapshot={snapshot}
            catalogue={catalogue}
            plan={plan}
          />
        )}

        {stage.owed.length > 0 && (
          <div>
            <h3 className="mb-2">Required</h3>
            <ul>
              {stage.owed.map((owed) => (
                <Row
                  key={owed.course + owed.part}
                  code={owed.course}
                  label={owed.course + owed.part}
                  title={catalogue.get(owed.course)?.title}
                  note={`Required after ${owed.course + owed.after} in ${termLabel(owed.afterTerm)}`}
                  credits={`${owedCredits(owed, catalogue)} cr`}
                  action={actions ? null : undefined}
                />
              ))}
            </ul>
          </div>
        )}

        {records.length > 0 && (
          <ul aria-label="Your courses">
            {records.map((record) => (
              <Row
                key={`${recordLabel(record)}-${record.status}`}
                code={record.code}
                label={recordLabel(record)}
                title={catalogue.get(record.code)?.title}
                note={creditNote(record, snapshot.pending)}
                meta={
                  <span className="flex items-center gap-2">
                    <StatusBadge status={record.status} />
                    {graded && (
                      <span className="w-6 font-semibold text-fg">
                        {record.grade}
                      </span>
                    )}
                  </span>
                }
                credits={`${recordCredits(record, catalogue)} cr`}
                action={actions ? null : undefined}
              />
            ))}
          </ul>
        )}

        {stage.planned.length > 0 && (
          <ul aria-label="Planned courses">
            {stage.planned.map((load) => {
              const course = catalogue.get(load.code);
              const whole = course
                ? courseLoads(load.code, course, load.start)
                : [load];
              const name = loadsName(whole);
              return (
                <Row
                  key={load.label}
                  code={load.code}
                  label={load.label}
                  title={course?.title}
                  uncertain={course ? isUncertain(course) : false}
                  note={partCaption(load)}
                  credits={`${load.credits} cr`}
                  action={
                    <>
                      <MoveMenu
                        name={name}
                        course={course}
                        options={targetsFor(load, course)}
                        onMove={(to) => move(load.code, to)}
                      />
                      <Button
                        variant="secondary"
                        icon
                        aria-label={`Remove ${name} from ${loadsTerms(whole)}`}
                        onClick={() => remove(load)}
                      >
                        <X aria-hidden />
                      </Button>
                    </>
                  }
                />
              );
            })}
          </ul>
        )}

        {!open && empty && (
          <p className="text-fg-muted">Nothing was recorded for this term.</p>
        )}

        {open && (
          <AddCourse
            term={stage.term}
            index={index}
            snapshot={snapshot}
            plan={plan}
          />
        )}
      </div>

      {suggestions.length > 0 && (
        <section
          aria-labelledby="suggestions-heading"
          className="px-5 pt-4 pb-4"
        >
          <h3 id="suggestions-heading" className="mb-2 text-fg-muted">
            Needed by your program
          </h3>
          <ul>
            {suggestions.map((course) => (
              <Row
                key={course.code}
                code={course.code}
                title={course.title}
                tip={`Offered ${seasonsOffered(course)}`}
                uncertain={isUncertain(course)}
                credits={<CreditsLabel course={course} />}
                action={
                  <Button
                    variant="secondary"
                    aria-label={`Add ${course.code} to ${label}`}
                    onClick={() => addWithUndo(stage.term, course.code)}
                  >
                    Add
                  </Button>
                }
              />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
