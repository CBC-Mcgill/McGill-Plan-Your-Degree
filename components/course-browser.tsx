"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CourseRow,
  CourseRowHeader,
  CourseRowSkeleton,
} from "@/components/course-row";
import { STATUS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlStyles, SelectField } from "@/components/ui/field";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses, searchCourses } from "@/lib/catalogue/search";
import {
  type BrowseStatus,
  courseStatus,
  isOffered,
} from "@/lib/engine/status";
import type { Season } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const PAGE_SIZE = 50;
const LEVELS = ["100", "200", "300", "400", "500", "600", "700"] as const;
const TERMS: Season[] = ["Fall", "Winter", "Summer"];
const STATUSES = (
  [
    "available",
    "completed",
    "covered",
    "in-progress",
    "planned",
    "locked",
  ] as const
).map((value) => ({ value, label: STATUS[value].label }));

interface Filters {
  q: string;
  subject: string;
  level: string;
  term: Season | "";
  status: BrowseStatus | "";
}

const NO_FILTERS: Filters = {
  q: "",
  subject: "",
  level: "",
  term: "",
  status: "",
};

function readFilters(params: URLSearchParams): Filters {
  const level = params.get("level");
  return {
    q: params.get("q") ?? "",
    subject: params.get("subject") ?? "",
    level: LEVELS.find((value) => value === level) ?? "",
    term: TERMS.find((value) => value === params.get("term")) ?? "",
    status: STATUSES.find((s) => s.value === params.get("status"))?.value ?? "",
  };
}

function toQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function CourseBrowser() {
  const params = useSearchParams();
  const urlQuery = params.toString();
  const [filters, setFilters] = useState(() => readFilters(params));
  const [seenUrl, setSeenUrl] = useState(urlQuery);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const input = useRef<HTMLInputElement>(null);

  // A link back to /courses clears the URL from outside, so follow it. Our own writes already match the filters.
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    if (urlQuery !== toQueryString(filters)) {
      setFilters(readFilters(params));
      setLimit(PAGE_SIZE);
    }
  }

  useEffect(() => input.current?.focus(), []);

  const catalogue = useCatalogue();
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const index = useMemo(
    () => (courses ? indexCourses(courses.values()) : []),
    [courses],
  );
  const subjects = useMemo(
    () => subjectOptions(index.map((entry) => entry.course)),
    [index],
  );

  const snapshot = useSnapshot();
  const states = useMemo(
    () =>
      snapshot
        ? new Map(
            index.map(({ course }) => [
              course.code,
              courseStatus(course, snapshot),
            ]),
          )
        : null,
    [index, snapshot],
  );

  const status = states ? filters.status : "";
  const results = useMemo(() => {
    const level = filters.level.slice(0, 1);
    return searchCourses(index, filters.q).filter(
      (course) =>
        (!filters.subject || course.subject === filters.subject) &&
        (!level || course.number.startsWith(level)) &&
        (!filters.term || isOffered(course, filters.term)) &&
        (!status || states?.get(course.code)?.status === status),
    );
  }, [index, states, filters, status]);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(PAGE_SIZE);
    const query = toQueryString(next);
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }

  const filtered = toQueryString({ ...filters, status }) !== "";
  const count = results.length;

  return (
    <>
      <div className="relative mt-6">
        <Search
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={input}
          type="search"
          aria-label="Search courses by code or title"
          placeholder="Search by code or title, like COMP 251 or algorithms"
          value={filters.q}
          onChange={(event) => update({ q: event.target.value })}
          className={`${controlStyles} w-full pl-9`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Select
          label="Subject"
          value={filters.subject}
          onChange={(subject) => update({ subject })}
          className="w-64"
          options={subjects}
          all="All subjects"
        />
        <Select
          label="Level"
          value={filters.level}
          onChange={(level) => update({ level })}
          options={LEVELS.map((value) => ({ value, label: value }))}
          all="All levels"
        />
        <Select
          label="Term offered"
          value={filters.term}
          onChange={(term) =>
            update({ term: TERMS.find((t) => t === term) ?? "" })
          }
          options={TERMS.map((value) => ({ value, label: value }))}
          all="Any term"
        />
        {states && (
          <Select
            label="Status"
            value={filters.status}
            onChange={(value) =>
              update({
                status: STATUSES.find((s) => s.value === value)?.value ?? "",
              })
            }
            options={STATUSES}
            all="All"
          />
        )}
        {filtered && (
          <Button
            variant="secondary"
            className="mb-0.5"
            onClick={() => {
              update(NO_FILTERS);
              input.current?.focus();
            }}
          >
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      <div className="mt-8">
        {catalogue.status !== "error" && (
          <div className="mb-2 flex items-baseline justify-between gap-6 text-[13px]">
            <p aria-live="polite" className="font-medium text-muted-foreground">
              {courses
                ? `${count.toLocaleString()} ${count === 1 ? "course" : "courses"}`
                : "Loading courses..."}
            </p>
            {snapshot === null && (
              <p className="text-muted-foreground">
                <Link
                  href="/profile"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  Import your transcript
                </Link>{" "}
                to see which courses you can take.
              </p>
            )}
          </div>
        )}
        {catalogue.status === "loading" && <CourseRowSkeleton rows={14} />}
        {catalogue.status === "error" && (
          <p role="alert">
            Could not load the course list. Reload the page to try again.
          </p>
        )}
        {courses &&
          (count === 0 ? (
            <Card className="px-6 py-12 text-center">
              <p className="font-semibold text-base">No courses match</p>
              <p className="mt-1 text-muted-foreground">
                Check the spelling, or clear your filters to see every course.
              </p>
              {filtered && (
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => {
                    update(NO_FILTERS);
                    input.current?.focus();
                  }}
                >
                  Clear filters
                </Button>
              )}
            </Card>
          ) : (
            <>
              <CourseRowHeader withStatus={Boolean(states)} />
              <Card asChild className="divide-y divide-border overflow-hidden">
                <ul>
                  {results.slice(0, limit).map((course) => (
                    <CourseRow
                      key={course.code}
                      course={course}
                      state={states?.get(course.code)}
                    />
                  ))}
                </ul>
              </Card>
              {count > limit && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setLimit(limit + PAGE_SIZE)}
                  >
                    Show more
                  </Button>
                  <p className="text-[13px] text-muted-foreground">
                    Showing {limit} of {count.toLocaleString()}
                  </p>
                </div>
              )}
            </>
          ))}
      </div>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  all,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  all: string;
  className?: string;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className ?? "w-40"}
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

/** "COMP - Computer Science", using the department that offers most of the subject's courses. */
function subjectOptions(
  courses: { subject: string; offeredBy: string | null }[],
) {
  const counts = new Map<string, Map<string, number>>();
  for (const { subject, offeredBy } of courses) {
    const byDepartment = counts.get(subject) ?? new Map<string, number>();
    if (offeredBy)
      byDepartment.set(offeredBy, (byDepartment.get(offeredBy) ?? 0) + 1);
    counts.set(subject, byDepartment);
  }
  return [...counts]
    .map(([subject, byDepartment]) => {
      const [name] = [...byDepartment].sort((a, b) => b[1] - a[1])[0] ?? [];
      return { value: subject, label: name ? `${subject} - ${name}` : subject };
    })
    .sort((a, b) => (a.value < b.value ? -1 : 1));
}
