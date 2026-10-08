"use client";

import { Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { CourseLink } from "@/components/course-link";
import { seasonsOffered } from "@/components/course-row";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlStyles } from "@/components/ui/field";
import { type IndexedCourse, searchCourses } from "@/lib/catalogue/search";
import type { CourseSummary } from "@/lib/catalogue/types";
import type { Snapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";

const MAX_RESULTS = 6;

function CourseLine({
  course,
  children,
}: {
  course: CourseSummary;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <CourseLink code={course.code} className="font-semibold" />{" "}
          <span title={course.title}>{course.title}</span>
        </p>
        <p className="text-[13px] text-muted-foreground">
          {course.credits === null ? "-" : `${course.credits} credits`} ·{" "}
          {seasonsOffered(course)}
        </p>
      </div>
      {children}
    </li>
  );
}

/** Search the catalogue and put a course in the selected term, plus the required courses that fit it. */
export function AddCourse({
  term,
  index,
  snapshot,
  suggestions,
  hasProgram,
}: {
  term: Term;
  index: readonly IndexedCourse[];
  snapshot: Snapshot;
  /** Remaining required courses that fit this term, or null when there is no program. */
  suggestions: CourseSummary[] | null;
  hasProgram: boolean;
}) {
  const inputId = useId();
  const plan = useProfileStore((state) => state.plan);
  const [query, setQuery] = useState("");
  const label = termLabel(term);

  const plannedHere = new Set(
    plan.find((entry) => termKey(entry.term) === termKey(term))?.courses,
  );
  const results = query.trim()
    ? searchCourses(index, query).slice(0, MAX_RESULTS)
    : [];

  function add(course: CourseSummary) {
    addWithUndo(term, course.code);
    setQuery("");
  }

  const addButton = (course: CourseSummary) => {
    const moving = snapshot.planned.has(course.code);
    return (
      <Button
        variant="secondary"
        size="sm"
        aria-label={`${moving ? "Move" : "Add"} ${course.code} to ${label}`}
        onClick={() => add(course)}
      >
        <Plus aria-hidden />
        {moving ? "Move here" : "Add"}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor={inputId} className="font-semibold">
          Add a course
        </label>
        <div className="relative mt-2">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            placeholder="Search by code or title, like COMP 251 or algorithms"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${controlStyles} w-full pl-9`}
          />
        </div>
        {query.trim() &&
          (results.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              No courses match "{query.trim()}".
            </p>
          ) : (
            <Card
              asChild
              className="mt-2 divide-y divide-border overflow-hidden"
            >
              <ul aria-label="Search results">
                {results.map((course) => {
                  const state = snapshot.covered.has(course.code)
                    ? "covered"
                    : snapshot.done.has(course.code)
                      ? "completed"
                      : snapshot.inProgress.has(course.code)
                        ? "in-progress"
                        : null;
                  return (
                    <CourseLine key={course.code} course={course}>
                      {state ? (
                        <StatusLabel status={state} />
                      ) : plannedHere.has(course.code) ? (
                        <StatusLabel status="planned" />
                      ) : (
                        addButton(course)
                      )}
                    </CourseLine>
                  );
                })}
              </ul>
            </Card>
          ))}
      </div>

      {hasProgram && !query.trim() && (
        <section aria-labelledby={`${inputId}-suggested`}>
          <h3 id={`${inputId}-suggested`} className="text-sm">
            Suggested for this term
          </h3>
          {suggestions && suggestions.length > 0 ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                Courses your program still needs, offered in {term.season}, with
                prerequisites met by earlier terms.
              </p>
              <Card
                asChild
                className="mt-3 divide-y divide-border overflow-hidden"
              >
                <ul>
                  {suggestions.slice(0, 5).map((course) => (
                    <CourseLine key={course.code} course={course}>
                      {addButton(course)}
                    </CourseLine>
                  ))}
                </ul>
              </Card>
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">
              No remaining required course fits this term.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
