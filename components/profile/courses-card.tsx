"use client";

import { useId, useState } from "react";
import { CourseRow, TermGroup } from "@/components/profile/course-row";
import { TermSelect } from "@/components/profile/selects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { useCatalogue } from "@/lib/catalogue/client";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm, groupByTerm } from "@/lib/profile/terms";
import { type Term, termKey } from "@/lib/profile/types";

const MAX_SUGGESTIONS = 8;
const CODE = /^[A-Z0-9]{4} [A-Z0-9]{3,6}$/;

/** "comp250" and "comp  250" both become "COMP 250". */
const normalizeCode = (text: string) =>
  text
    .trim()
    .toUpperCase()
    .replace(/^([A-Z0-9]{4})\s*([A-Z0-9]{3,6})$/, "$1 $2");

export function CoursesCard() {
  const records = useProfileStore((s) => s.records);
  const addCourse = useProfileStore((s) => s.addCourse);
  const removeCourse = useProfileStore((s) => s.removeCourse);
  const catalogue = useCatalogue();
  const listId = useId();

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

  function add(event: React.FormEvent) {
    event.preventDefault();
    const code = normalizeCode(text);
    const course = ready?.get(code);
    if (!CODE.test(code)) {
      setError("Enter a course code such as COMP 250.");
    } else if (ready && !course) {
      setError(
        `${code} is not in the catalogue. Check the code and try again.`,
      );
    } else if (records.some((r) => r.code === code)) {
      setError(`${code} is already in your profile.`);
    } else {
      addCourse({
        code,
        term: chosenTerm,
        credits: course?.credits ?? null,
        grade: null,
        status: chosenStatus,
      });
      setText("");
      setError(null);
    }
  }

  const groups = groupByTerm(records).reverse();

  return (
    <Card asChild className="p-5">
      <section>
        <h2 className="text-base">Your courses</h2>

        <form
          onSubmit={add}
          className="mt-3 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-4 rounded-lg bg-subtle p-4 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <TextField
            label="Add a course by code"
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
          <Button type="submit" variant="secondary" className="mb-0.5">
            Add course
          </Button>
          {error && (
            <p role="alert" className="col-span-4 font-medium text-danger">
              {error}
            </p>
          )}
        </form>

        {groups.length === 0 ? (
          <p className="mt-5 rounded-lg border border-border-strong border-dashed p-6 text-center text-muted-foreground">
            No courses yet. Add one above, or import your transcript.
          </p>
        ) : (
          <div className="mt-5 grid gap-5">
            {groups.map(({ term: groupTerm, items }) => (
              <TermGroup
                key={groupTerm ? termKey(groupTerm) : "before"}
                term={groupTerm}
                count={items.length}
              >
                {items.map((record) => (
                  <CourseRow
                    key={`${record.code}-${record.term ? termKey(record.term) : "none"}`}
                    code={record.code}
                    title={ready?.get(record.code)?.title ?? null}
                    credits={record.credits}
                    grade={record.grade}
                    status={record.status}
                    missing={ready !== null && !ready.has(record.code)}
                    onRemove={() => removeCourse(record.code)}
                  />
                ))}
              </TermGroup>
            ))}
          </div>
        )}
      </section>
    </Card>
  );
}
