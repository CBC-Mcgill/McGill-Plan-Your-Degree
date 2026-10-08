"use client";

import { cn } from "cn";
import { Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { STATUS, StatusIcon } from "@/components/status";
import { controlStyles } from "@/components/ui/field";
import { type IndexedCourse, searchCourses } from "@/lib/catalogue/search";
import type { CourseSummary } from "@/lib/catalogue/types";
import type { Snapshot } from "@/lib/engine/snapshot";
import { courseStatus } from "@/lib/engine/status";
import { termLabel } from "@/lib/profile/term-options";
import { type Plan, type Term, termKey } from "@/lib/profile/types";

const MAX_RESULTS = 6;

/** Search combobox that puts a course in the term. Arrow keys move, Enter adds, Escape clears or closes. A course planned elsewhere moves here. */
export function AddCourse({
  term,
  index,
  snapshot,
  plan,
}: {
  term: Term;
  index: readonly IndexedCourse[];
  snapshot: Snapshot;
  plan: Plan;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const text = query.trim();
  const results = text ? searchCourses(index, text).slice(0, MAX_RESULTS) : [];
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
      note: done
        ? STATUS[status].label
        : here
          ? "Planned here"
          : at
            ? `In ${termLabel(at)}`
            : "",
    };
  };

  function commit(course: CourseSummary | undefined) {
    if (!course || stateOf(course).disabled) return;
    addWithUndo(term, course.code);
    setQuery("");
    setActive(0);
    setOpen(false);
  }

  const showList = open && text.length > 0;

  return (
    <div ref={wrap} className="relative">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          type="text"
          role="combobox"
          aria-label={`Add a course to ${label}`}
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={
            showList && results.length > 0 ? `${listId}-${active}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search by code or title, like COMP 251"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!wrap.current?.contains(event.relatedTarget)) setOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((value) =>
                results.length
                  ? (value + step + results.length) % results.length
                  : 0,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              commit(results[active]);
            } else if (event.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
          }}
          className={cn(controlStyles, "w-full pr-3 pl-8")}
        />
      </div>
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg bg-card p-1 shadow-float"
        >
          {results.length === 0 && (
            <p className="px-2 py-2.5 text-[13px] text-muted-foreground">
              No courses match "{text}"
            </p>
          )}
          {results.map((course, i) => {
            const state = stateOf(course);
            return (
              <button
                key={course.code}
                type="button"
                role="option"
                id={`${listId}-${i}`}
                aria-selected={i === active}
                aria-disabled={state.disabled}
                onMouseMove={() => setActive(i)}
                onClick={() => commit(course)}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left",
                  i === active && "bg-subtle",
                  state.disabled && "cursor-default text-muted-foreground",
                )}
              >
                <StatusIcon status={state.status} />
                <span className="w-[76px] shrink-0 whitespace-nowrap font-semibold tabular-nums">
                  {course.code}
                </span>
                <span className="min-w-0 flex-1 truncate" title={course.title}>
                  {course.title}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {state.note || `${course.credits ?? "?"} cr`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
