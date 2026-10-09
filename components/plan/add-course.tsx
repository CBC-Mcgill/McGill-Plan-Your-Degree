"use client";

import { cn } from "cn";
import { Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { STATUS, StatusIcon } from "@/components/status";
import { controlStyles } from "@/components/ui/field";
import { type IndexedCourse, searchCourses } from "@/lib/catalogue/search";
import type { CourseSummary } from "@/lib/catalogue/types";
import { creditsLabel } from "@/lib/engine/parts";
import type { Snapshot } from "@/lib/engine/snapshot";
import { courseStatus } from "@/lib/engine/status";
import { termLabel } from "@/lib/profile/term-options";
import { type Plan, type Term, termKey } from "@/lib/profile/types";

const MAX_RESULTS = 6;

/** Search combobox that puts a course in the term. The first course that can be added is highlighted, arrow keys skip the rest, Enter adds and Escape clears. A course planned elsewhere moves here. */
export function AddCourse({
  term,
  index,
  snapshot,
  plan,
  placeholder,
}: {
  term: Term;
  index: readonly IndexedCourse[];
  snapshot: Snapshot;
  plan: Plan;
  placeholder?: string;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const text = query.trim();
  const label = termLabel(term);

  const stateOf = (course: CourseSummary) => {
    const { status } = courseStatus(course, snapshot);
    const at = plan.find((entry) => entry.courses.includes(course.code))?.term;
    const done =
      status === "completed" ||
      status === "covered" ||
      status === "in-progress";
    const here = at !== undefined && termKey(at) === termKey(term);
    return {
      status,
      disabled: done || here,
      reason: here
        ? `is already planned in ${label}`
        : `is already ${STATUS[status].label.toLowerCase()}`,
      note: done
        ? STATUS[status].label
        : here
          ? "Planned here"
          : at
            ? `In ${termLabel(at)}`
            : "",
    };
  };

  const results = (text ? searchCourses(index, text) : [])
    .slice(0, MAX_RESULTS)
    .map((course) => ({ course, ...stateOf(course) }));
  const enabled = results.flatMap((result, i) => (result.disabled ? [] : i));
  const chosen = results.findIndex(
    (result) => result.course.code === picked && !result.disabled,
  );
  const active = chosen >= 0 ? chosen : (enabled[0] ?? -1);

  function commit(course: CourseSummary | undefined) {
    if (!course) return;
    const state = stateOf(course);
    if (state.disabled) {
      setNotice(`${course.code} ${state.reason}`);
      return;
    }
    addWithUndo(term, course.code);
    setQuery("");
    setPicked(null);
    setOpen(false);
  }

  const showList = open && text.length > 0;
  const showResults = showList && results.length > 0;

  return (
    <div ref={wrap} className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        type="text"
        role="combobox"
        aria-label={`Add a course to ${label}`}
        aria-expanded={showResults}
        aria-controls={showResults ? listId : undefined}
        aria-activedescendant={
          showResults && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? `Add a course to ${label}, like COMP 251`}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!wrap.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setPicked(null);
          setNotice("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setNotice("");
            const at = enabled.indexOf(active);
            const step = event.key === "ArrowDown" ? 1 : -1;
            const next = enabled[(at + step + enabled.length) % enabled.length];
            if (next !== undefined)
              setPicked(results[next]?.course.code ?? null);
          } else if (event.key === "Enter") {
            event.preventDefault();
            // With nothing to add, Enter says why the first match cannot be added.
            commit((results[active] ?? results[0])?.course);
          } else if (event.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
        className={cn(controlStyles, "w-full pl-9")}
      />
      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg bg-bg p-1 shadow-float transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none">
          {showResults && (
            <div
              id={listId}
              role="listbox"
              aria-label="Search results"
              onMouseDown={(event) => event.preventDefault()}
            >
              {results.map(({ course, status, disabled, note }, i) => (
                <button
                  key={course.code}
                  type="button"
                  role="option"
                  id={`${listId}-${i}`}
                  aria-selected={i === active}
                  aria-disabled={disabled}
                  onMouseMove={() => !disabled && setPicked(course.code)}
                  onClick={() => commit(course)}
                  className={cn(
                    "flex h-10 w-full items-center gap-4 rounded-md px-3 text-left",
                    i === active && "selected",
                    disabled && "cursor-default text-fg-muted",
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <StatusIcon status={status} label={STATUS[status].label} />
                    <span className="w-24 shrink-0 font-semibold tabular-nums">
                      {course.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-normal">
                      {course.title}
                    </span>
                  </span>
                  <span className="shrink-0 font-normal text-fg-muted tabular-nums">
                    {note || creditsLabel(course)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p role="status" className="px-3 py-2 text-fg-muted empty:hidden">
            {showResults ? notice : `No courses match "${text}"`}
          </p>
        </div>
      )}
    </div>
  );
}
