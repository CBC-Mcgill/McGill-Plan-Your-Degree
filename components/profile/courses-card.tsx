"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RecordTable, StatusCounts } from "@/components/profile/record-table";
import { TermSelect } from "@/components/profile/selects";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { Term as Definition } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { COPY } from "@/lib/copy";
import { degreeStanding } from "@/lib/engine/credits";
import { creditNote } from "@/lib/engine/parts";
import type { Catalogue } from "@/lib/engine/snapshot";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm } from "@/lib/profile/terms";
import {
  type CourseRecord,
  logicalCode,
  partOf,
  recordLabel,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";

const MAX_SUGGESTIONS = 8;
const NO_CATALOGUE: Catalogue = new Map();
const CODE = /^[A-Z0-9]{4} [A-Z0-9]{3,6}$/;

/** "comp250" and "comp  250" both become "COMP 250". */
const normalizeCode = (text: string) =>
  text
    .trim()
    .toUpperCase()
    .replace(/^([A-Z0-9]{4})\s*([A-Z0-9]{3,6})$/, "$1 $2");

/** Removes a record and offers Undo, which puts back exactly the records it took. */
function removeWithUndo(record: CourseRecord) {
  const before = useProfileStore.getState().records;
  useProfileStore.getState().removeCourse(record.code, record.part);
  const after = new Set(useProfileStore.getState().records);
  const removed = before.filter((r) => !after.has(r));
  toast(`${recordLabel(record)} removed`, {
    label: COPY.undo,
    run: () =>
      useProfileStore.setState((s) => ({
        records: [...s.records, ...removed],
      })),
  });
}

export function CoursesCard() {
  const records = useProfileStore((s) => s.records);
  const plan = useProfileStore((s) => s.plan);
  const advancedStanding = useProfileStore((s) => s.advancedStanding);
  const entry = useProfileStore((s) => s.entry);
  const program = useProgram(useProfileStore((s) => s.programId));
  const addCourse = useProfileStore((s) => s.addCourse);
  const catalogue = useCatalogue();
  const snapshot = useSnapshot();
  const listId = useId();
  const formId = useId();

  const [adding, setAdding] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const codeField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) codeField.current?.focus();
  }, [adding]);

  const [text, setText] = useState("");
  const [term, setTerm] = useState<Term | null>(null);
  const [status, setStatus] = useState<"completed" | "in-progress" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const ready = catalogue.status === "ready" ? catalogue.catalogue : null;
  const query = normalizeCode(text);
  const suggestions =
    ready && query.length >= 2
      ? [...ready.values()]
          .filter(
            (course) =>
              course.code.startsWith(query) ||
              course.title.toUpperCase().includes(query),
          )
          .slice(0, MAX_SUGGESTIONS)
      : [];

  const latest = records
    .flatMap((r) => r.term ?? [])
    .sort((a, b) => termKey(b) - termKey(a))[0];
  const chosenTerm = term ?? latest ?? currentTerm();
  // A course in the current term or later is still being taken.
  const chosenStatus =
    status ??
    (termKey(chosenTerm) >= termKey(currentTerm())
      ? "in-progress"
      : "completed");

  function close() {
    setAdding(false);
    setError(null);
    toggle.current?.focus();
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const code = normalizeCode(text);
    const part = partOf(code);
    const course = ready?.get(logicalCode(code));
    const credits = part
      ? course?.parts?.find((p) => p.code === code)?.credits
      : course?.credits;
    if (!CODE.test(code)) {
      setError("Enter a course code such as COMP 250.");
    } else if (ready && (!course || (part && credits === undefined))) {
      setError(
        `${code} is not in the catalogue. Check the code and try again.`,
      );
    } else if (
      records.some((r) => r.code === logicalCode(code) && r.part === part)
    ) {
      setError(`${code} is already in your profile.`);
    } else {
      addCourse({
        code: logicalCode(code),
        ...(part && { part }),
        term: chosenTerm,
        credits: credits ?? null,
        grade: null,
        status: chosenStatus,
      });
      setText("");
      setError(null);
    }
  }

  const standing =
    snapshot &&
    degreeStanding(
      snapshot,
      ready ?? NO_CATALOGUE,
      {
        records,
        plan,
        advancedStanding,
        creditsRequired: null,
        entry,
      },
      program ?? null,
    );

  return (
    <Section
      id="courses"
      title="Courses"
      meta={
        standing &&
        (standing.earned > 0 || standing.inProgress > 0) && (
          <>
            {standing.earned}{" "}
            <Definition def={GLOSSARY.creditsEarned}>credits earned</Definition>
            , {standing.inProgress} in progress
          </>
        )
      }
      action={
        <Button
          ref={toggle}
          variant="secondary"
          aria-expanded={adding}
          aria-controls={formId}
          onClick={() => (adding ? close() : setAdding(true))}
        >
          Add a course
        </Button>
      }
    >
      {records.length > 0 && (
        <StatusCounts statuses={records.map((record) => record.status)} />
      )}
      <form
        id={formId}
        hidden={!adding}
        onSubmit={add}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="mt-4 mb-2 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-4 first:mt-0"
      >
        <TextField
          ref={codeField}
          label="Code"
          value={text}
          list={listId}
          placeholder="COMP 250"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
        />
        <datalist id={listId}>
          {suggestions.map((course) => (
            <option key={course.code} value={course.code}>
              {course.title}
            </option>
          ))}
        </datalist>
        <TermSelect label="Term" value={chosenTerm} onChange={setTerm} />
        <SelectField
          label="Status"
          value={chosenStatus}
          onChange={(event) =>
            setStatus(event.target.value as "completed" | "in-progress")
          }
        >
          <option value="completed">Completed</option>
          <option value="in-progress">In progress</option>
        </SelectField>
        <Button type="submit" variant="secondary">
          Add
        </Button>
        {error && (
          <p role="alert" className="col-span-4 text-danger">
            {error}
          </p>
        )}
      </form>

      {records.length === 0 ? (
        <p className="text-fg-muted">
          No courses yet. Add the ones you have taken, or import your transcript
          under Your data.
        </p>
      ) : (
        <div className="mt-3">
          <RecordTable
            rows={records.map((record) => ({
              key: `${recordLabel(record)}-${record.term ? termKey(record.term) : "none"}`,
              code: recordLabel(record),
              title: ready?.get(record.code)?.title ?? null,
              term: record.term,
              credits: record.credits,
              grade: record.grade,
              status: record.status,
              note: creditNote(record, snapshot?.pending),
              missing: ready !== null && !ready.has(record.code),
              onRemove: () => removeWithUndo(record),
            }))}
          />
        </div>
      )}
    </Section>
  );
}
