"use client";

import { cn } from "cn";
import { ChevronDown, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { type ReactNode, useId, useRef, useState } from "react";
import { CourseCode } from "@/components/course-code";
import { ROW, ROW_LINK, ROW_TITLE } from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import { VsbLink } from "@/components/external-link";
import { AddCourse } from "@/components/plan/add-course";
import {
  addAllWithUndo,
  addWithUndo,
  removeWithUndo,
} from "@/components/plan/add-with-undo";
import { TermWarnings } from "@/components/plan/term-warnings";
import {
  STATUS,
  type Status,
  StatusBadge,
  StatusBar,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { BAND, CARD } from "@/components/ui/card";
import { ShowMore } from "@/components/ui/disclosure";
import { TextField } from "@/components/ui/field";
import { Menu, MenuItem } from "@/components/ui/menu";
import { ViewTabs } from "@/components/ui/tabs";
import { InfoButton } from "@/components/ui/tooltip";
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
  startTerm,
} from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import {
  type FillOption,
  fillForTerm,
  owedCredits,
  recordCredits,
  type Stage,
} from "@/lib/engine/stages";
import { isOffered, isUncertain } from "@/lib/engine/status";
import { sentence } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import type { Plan, Term } from "@/lib/profile/types";
import { recordLabel, termKey } from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";
import { describe } from "./term-path";

/** Checklist rows shown before Show N more. */
const VISIBLE = 8;

export interface MoveOption {
  term: Term;
  credits: number;
  /** What the menu says when it is not the term alone, such as "Fall 2027 and Winter 2028". */
  label?: string;
}

/**
 * A row of what a term holds: the status glyph, a code like ECSE 458D1, the title, and the credits at the right edge, which line up with the checklist's.
 * `action` shows over the end of the row on hover and focus within it.
 */
function Row({
  code,
  label = code,
  status,
  title,
  uncertain = false,
  note,
  grade,
  credits,
  action,
}: {
  code: string;
  label?: string;
  status: Status;
  /** Missing when the catalogue has no such course, so the row does not link. */
  title: string | undefined;
  uncertain?: boolean;
  note?: string;
  grade?: ReactNode;
  credits: number;
  action?: ReactNode;
}) {
  const body = (
    <>
      <span className="w-24 shrink-0 font-semibold tabular-nums">
        <CourseCode code={label} />
      </span>
      <span className="min-w-0">
        <span className={title ? "block" : "block text-fg-muted"}>
          {title ?? "Not in the catalogue"}
        </span>
        {note && <span className="block text-fg-muted">{note}</span>}
      </span>
    </>
  );
  return (
    <li className={cn(ROW, "relative has-[[data-state=open]]:bg-tint")}>
      <span className={ROW_TITLE}>
        <StatusTip status={status} className="flex min-w-0 gap-3">
          <span className="flex h-5 w-4 shrink-0 items-center">
            <StatusIcon status={status} label={STATUS[status].label} />
          </span>
          {title ? (
            <Link
              href={`/courses/${courseSlug(code)}`}
              prefetch={false}
              className={ROW_LINK}
            >
              {body}
            </Link>
          ) : (
            <span className="flex min-w-0 gap-4">{body}</span>
          )}
        </StatusTip>
        {uncertain && <UncertainFlag />}
      </span>
      {action && (
        // Over the title's end on hover, on the grey a hovered row shows, so a long title keeps the full width.
        <span className="absolute top-1/2 right-[5.75rem] flex -translate-y-1/2 gap-1 bg-page pl-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
          {action}
        </span>
      )}
      {grade !== undefined && (
        <span className="w-8 shrink-0 text-right font-semibold text-fg-muted">
          {grade}
        </span>
      )}
      <span className="w-14 shrink-0 text-right text-fg-muted tabular-nums">
        {credits} cr
      </span>
    </li>
  );
}

/** The grey band over a list in the term card: its name and how many rows. */
function Band({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex h-9 items-center gap-2 border-line border-b bg-subtle px-5 text-[13px] leading-[18px]">
      <h3 className="text-[13px] leading-[18px]">{title}</h3>
      <span className="text-fg-muted tabular-nums">{count}</span>
    </div>
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

type Filter = "all" | FillOption["kind"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "required", label: "Required" },
  { id: "complementary", label: "Complementary" },
];

/** What fits the term as a checklist, filtered by what it counts toward, with a running total of the picks and the term's load before one Add commits them. */
function Fill({
  stage,
  options,
  program,
  catalogue,
  creditLimit,
}: {
  stage: Stage;
  options: FillOption[];
  program: Program;
  catalogue: Catalogue;
  creditLimit: number;
}) {
  const panelId = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const label = termLabel(stage.term);
  // Both kinds or none: a filter with one choice would filter nothing.
  const filtered = new Set(options.map((option) => option.kind)).size > 1;
  const shown = options.filter(
    (option) => filter === "all" || option.kind === filter,
  );
  const codes = options
    .map((option) => option.course.code)
    .filter((code) => picked.has(code));
  // A multi-term course adds only the part that falls in this term.
  const load = (code: string) => {
    const course = catalogue.get(code);
    return course
      ? courseLoads(code, course, startTerm(course, stage.term))
          .filter((part) => termKey(part.term) === stage.key)
          .reduce((sum, part) => sum + part.credits, 0)
      : 0;
  };
  const adding = codes.reduce((sum, code) => sum + load(code), 0);
  const total = stage.credits + adding;
  const over = total > creditLimit;

  function toggle(code: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  const rows = (part: FillOption[]) => (
    <ul>
      {part.map(({ course, group }) => {
        const checked = picked.has(course.code);
        const counts = sentence(program.groups[group]?.title ?? "");
        return (
          <li key={course.code} className="-mx-5 border-line border-b">
            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-4 px-5 py-2 hover:bg-tint",
                checked && "bg-tint",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(course.code)}
                className="size-4 shrink-0 accent-[var(--fg)]"
              />
              <span className="w-24 shrink-0 font-semibold tabular-nums">
                <CourseCode code={course.code} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={course.title}>
                  {course.title}
                </span>
                <span className="block truncate text-fg-muted xl:hidden">
                  {counts}
                </span>
              </span>
              <span
                className="hidden w-72 shrink-0 truncate text-fg-muted xl:block"
                title={counts}
              >
                {counts}
              </span>
              <span className="w-14 shrink-0 whitespace-nowrap text-right text-fg-muted tabular-nums">
                <CreditsLabel course={course} />
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  const list = (
    <>
      {rows(shown.slice(0, VISIBLE))}
      {shown.length > VISIBLE && (
        <ShowMore count={shown.length - VISIBLE}>
          {rows(shown.slice(VISIBLE))}
        </ShowMore>
      )}
    </>
  );

  return (
    <section aria-labelledby={`${panelId}-heading`}>
      <div className="flex min-h-12 items-center gap-4 border-line border-b bg-subtle px-5 py-1.5">
        <h3 id={`${panelId}-heading`} className="text-[13px] leading-[18px]">
          Fill {label}
        </h3>
        {filtered && (
          <div className="ml-auto">
            <ViewTabs
              label="Counts toward"
              tabs={FILTERS}
              value={filter}
              onChange={setFilter}
              panelId={panelId}
            />
          </div>
        )}
      </div>
      {filtered ? (
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-${filter}`}
          className="px-5"
        >
          {list}
        </div>
      ) : (
        <div className="px-5">{list}</div>
      )}
      <div className="flex min-h-15 items-center gap-4 px-5 py-3">
        <p
          aria-live="polite"
          className={cn("min-w-0 tabular-nums", over && "text-warn")}
        >
          {codes.length === 0 ? (
            <span className="text-fg-muted">
              Pick the courses you want, then add them all at once.
            </span>
          ) : (
            <>
              <span className="font-semibold">
                {codes.length} selected, {COPY.credits(adding)}.
              </span>{" "}
              <span className={over ? undefined : "text-fg-muted"}>
                {label} would hold {total} of {creditLimit} credits
                {over && ", over your limit"}.
              </span>
            </>
          )}
        </p>
        <Button
          className="ml-auto"
          disabled={codes.length === 0}
          onClick={() => {
            addAllWithUndo(stage.term, codes);
            setPicked(new Set());
          }}
        >
          {codes.length === 0
            ? "Add courses"
            : `Add ${codes.length} ${codes.length === 1 ? "course" : "courses"}`}
        </Button>
      </div>
    </section>
  );
}

/** The selected term as a card: its status and load, warnings, courses, and for a term ahead, a checklist of what fits and a search for anything else. Planned courses can move or go. */
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

  const nowKey = termKey(now);
  const label = termLabel(stage.term);
  const { status, word } = describe(stage, nowKey);
  // Only terms after the current one take new courses.
  const open = stage.key > nowKey;
  const over = stage.credits > creditLimit;
  const registered = stage.records
    .filter((record) => record.status === "in-progress")
    .reduce((sum, record) => sum + recordCredits(record, catalogue), 0);
  const records = [...stage.records].sort((a, b) =>
    recordLabel(a) < recordLabel(b) ? -1 : 1,
  );
  const graded = records.some((record) => record.grade);
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
  const options =
    open && program
      ? fillForTerm(program, snapshot, catalogue, plan, stage.term, entry)
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
      className={cn(CARD, "divide-y divide-line")}
    >
      <header className={BAND}>
        <h2
          ref={heading}
          id="term-heading"
          tabIndex={-1}
          className="rounded-md"
        >
          {label}
        </h2>
        <StatusBadge status={status} word={word} />
        {open || stage.state === "current" ? (
          <div className="ml-auto flex items-center gap-3">
            <StatusBar
              completed={0}
              inProgress={registered}
              planned={stage.credits - registered}
              total={creditLimit}
              className="w-24 xl:w-32"
            />
            <p
              className={cn(
                "flex items-center whitespace-nowrap tabular-nums",
                over ? "font-semibold text-warn" : "text-fg-muted",
              )}
            >
              {over && <TriangleAlert aria-hidden className="mr-1.5 size-4" />}
              <span>
                {stage.credits} of <CreditLimit limit={creditLimit} /> credits
                {over && ", over your limit"}
              </span>
              <InfoButton def={GLOSSARY.creditLimit} />
            </p>
          </div>
        ) : (
          <p className="ml-auto text-fg-muted tabular-nums">
            {COPY.credits(stage.credits)}
          </p>
        )}
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

      {stage.owed.length > 0 && (
        <section>
          <Band title="Required" count={stage.owed.length} />
          <ul className="px-5">
            {stage.owed.map((owed) => (
              <Row
                key={owed.course + owed.part}
                code={owed.course}
                label={owed.course + owed.part}
                status="available"
                title={catalogue.get(owed.course)?.title}
                note={`Required after ${owed.course + owed.after} in ${termLabel(owed.afterTerm)}`}
                credits={owedCredits(owed, catalogue)}
              />
            ))}
          </ul>
        </section>
      )}

      {records.length > 0 && (
        <section>
          <Band title="Your courses" count={records.length} />
          <ul aria-label="Your courses" className="px-5">
            {records.map((record) => (
              <Row
                key={`${recordLabel(record)}-${record.status}`}
                code={record.code}
                label={recordLabel(record)}
                status={record.status}
                title={catalogue.get(record.code)?.title}
                note={creditNote(record, snapshot.pending)}
                grade={graded ? (record.grade ?? "") : undefined}
                credits={recordCredits(record, catalogue)}
              />
            ))}
          </ul>
        </section>
      )}

      {stage.planned.length > 0 && (
        <section>
          <Band title="Planned" count={stage.planned.length} />
          <ul aria-label="Planned courses" className="px-5">
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
                  status="planned"
                  title={course?.title}
                  uncertain={course ? isUncertain(course) : false}
                  note={partCaption(load)}
                  credits={load.credits}
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
        </section>
      )}

      {!open && empty && (
        <p className="px-5 py-4 text-fg-muted">
          Nothing was recorded for this term.
        </p>
      )}

      {open && program && options.length > 0 && (
        <Fill
          stage={stage}
          options={options}
          program={program}
          catalogue={catalogue}
          creditLimit={creditLimit}
        />
      )}

      {open && (
        <div className="px-5 py-4">
          {options.length === 0 && <h3 className="mb-2">Add a course</h3>}
          <AddCourse
            term={stage.term}
            index={index}
            snapshot={snapshot}
            plan={plan}
            placeholder={
              options.length > 0
                ? "Not listed? Search all courses, like COMP 251"
                : undefined
            }
          />
        </div>
      )}

      {(open || stage.state === "current") && (
        <p className="px-5 py-4 text-fg-muted">
          This plan picks your courses. Pick their sections and times in
          McGill's <VsbLink />.
        </p>
      )}
    </section>
  );
}
