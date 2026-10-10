"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { CourseCode } from "@/components/course-code";
import { FilterPopover, SearchField } from "@/components/course-filters";
import {
  BrowseSkeleton,
  SeasonLetters,
  seasonsOffered,
} from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import {
  STATUS,
  StatusBadge,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ViewTabs } from "@/components/ui/tabs";
import { Term } from "@/components/ui/tooltip";
import meta from "@/data/catalogue/meta.json";
import { useCatalogue } from "@/lib/catalogue/client";
import { searchCourses } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import {
  buildBase,
  type CatalogueBase,
  inView,
  NO_FILTERS,
  optionsOf,
  PROPS,
  type Prop,
  passes,
  pinSubjects,
  programCodes,
  type Query,
  queryString,
  readQuery,
  type Student,
  sortCourses,
  statusDetail,
  statusOf,
  subjectOf,
  type View,
  viewsFor,
} from "@/lib/engine/browse";
import { buildSnapshot, type Snapshot } from "@/lib/engine/snapshot";
import { canTakeNow, courseStatus } from "@/lib/engine/status";
import { GLOSSARY, VIEW_TIPS } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import type { CourseRecord, Plan } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import { replaceUrl, useScrollMemory } from "@/lib/use-scroll-memory";

const PAGE_SIZE = 50;
const PANEL = "course-panel";
const EMPTY = buildSnapshot([], [], null);
const NO_CODES: ReadonlySet<string> = new Set();
/** Cells share the row's hover and focus tint and a hairline above, so each row reads as one 44px line across the card. */
const CELL =
  "border-line border-t pr-4 first:pl-5 last:pr-5 group-focus-within:bg-tint group-hover:bg-tint";
const HEAD = "pr-4 font-normal first:pl-5 last:pr-5";

interface Browse extends CatalogueBase, Student {
  /** False for a visitor with no transcript or plan, who sees no statuses. */
  hasProfile: boolean;
  views: { value: View; label: string }[];
  programSubjects: ReadonlySet<string>;
  snapshot: Snapshot;
  records: CourseRecord[];
  plan: Plan;
}

type BrowseData =
  | { status: "loading" | "error" }
  | ({ status: "ready" } & Browse);

/** The search index, the status map and the program courses, each rebuilt only when its own input changes. */
function useBrowse(): BrowseData {
  const catalogue = useCatalogue();
  const snapshot = useSnapshot();
  const program = useProgram(useProfileStore((state) => state.programId));
  const minor = useProgram(useProfileStore((state) => state.minorId));
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const base = useMemo(
    () => (courses ? buildBase(courses.values()) : null),
    [courses],
  );
  const inProgram = useMemo(
    () =>
      base && program !== undefined && minor !== undefined
        ? programCodes(program, minor, base.index)
        : null,
    [base, program, minor],
  );
  const states = useMemo(
    () =>
      base && snapshot !== undefined
        ? new Map(
            base.index.map(({ course }) => [
              course.code,
              courseStatus(course, snapshot ?? EMPTY),
            ]),
          )
        : null,
    [base, snapshot],
  );
  const canTake = useMemo(
    () =>
      base && snapshot
        ? new Set(
            base.index
              .filter(({ course }) =>
                canTakeNow(course, snapshot, meta.catalogueYear),
              )
              .map(({ course }) => course.code),
          )
        : NO_CODES,
    [base, snapshot],
  );
  const programSubjects = useMemo(
    () => new Set([...(inProgram?.keys() ?? [])].map(subjectOf)),
    [inProgram],
  );
  const subjects = useMemo(
    () => (base ? pinSubjects(base.subjects, programSubjects) : null),
    [base, programSubjects],
  );
  if (catalogue.status === "error") return { status: "error" };
  if (!base || !subjects || !inProgram || !states || snapshot === undefined) {
    return { status: "loading" };
  }
  return {
    status: "ready",
    ...base,
    subjects,
    states,
    inProgram,
    canTake,
    programSubjects,
    hasProfile: snapshot !== null,
    views: viewsFor(snapshot !== null, inProgram.size > 0),
    snapshot: snapshot ?? EMPTY,
    records,
    plan,
  };
}

export function CourseBrowser() {
  const b = useBrowse();
  if (b.status === "ready") return <CourseTable b={b} />;
  if (b.status === "loading") return <BrowseSkeleton />;
  return <CatalogueError />;
}

/** Views, filter chips and 50 rows a page. The URL holds the whole query. */
function CourseTable({ b }: { b: Browse }) {
  const params = useSearchParams();
  const urlQuery = params.toString();
  const [query, setQuery] = useState(() => readQuery(params, b.views));
  const [seenUrl, setSeenUrl] = useState(urlQuery);
  const [open, setOpen] = useState<Prop | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // A link back to /courses clears the URL from outside, so follow it. Our own writes already match the query.
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    if (urlQuery !== queryString(query, b.views)) {
      setQuery(readQuery(params, b.views));
    }
  }

  useScrollMemory();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searched = useMemo(
    () => searchCourses(b.index, query.q),
    [b.index, query.q],
  );
  const rows = useMemo(
    () =>
      sortCourses(
        searched.filter(
          (course) =>
            inView(query.view, course, b) && passes(course, query.filters),
        ),
        query.sort,
        b,
        query.view,
        query.q.trim() !== "",
      ),
    [searched, query.view, query.filters, query.sort, query.q, b],
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(query.page, pages);
  const first = (current - 1) * PAGE_SIZE;
  const shown = rows.slice(first, first + PAGE_SIZE);

  // A URL the page cannot honor, such as page=999 or view=planned, is rewritten to what is shown.
  useEffect(() => {
    const canonical = queryString({ ...query, page: current }, b.views);
    if (canonical !== window.location.search.slice(1)) {
      replaceUrl(canonical ? `?${canonical}` : window.location.pathname);
    }
  }, [query, current, b.views]);

  /** Any change but the page number starts again from page 1. */
  function update(patch: Partial<Query>) {
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    const string = queryString(next, b.views);
    replaceUrl(string ? `?${string}` : window.location.pathname);
  }
  const goTo = (page: number) => {
    update({ page });
    top.current?.scrollIntoView({ block: "start" });
  };

  const searching = query.q !== "";
  const filtering = PROPS.some((prop) => query.filters[prop].length > 0);
  // Every row in "Can take now" has the same status, so the column only shows in mixed views.
  const statuses = b.hasProfile && query.view !== "can-take";

  return (
    <div ref={top} className="scroll-mt-6">
      {b.hasProfile ? (
        // On a phone the tabs fill the width and grow to 44px for the thumb.
        <div className="max-md:[&>[role=tablist]]:h-11 max-md:[&>[role=tablist]]:w-full max-md:[&_[role=tab]]:h-10 max-md:[&_[role=tab]]:grow">
          <ViewTabs
            label="Views"
            panelId={PANEL}
            value={query.view}
            onChange={(view) => update({ view })}
            tabs={b.views.map((tab) => ({
              id: tab.value,
              label: tab.label,
              tip: VIEW_TIPS[tab.value],
            }))}
          />
        </div>
      ) : (
        <p className="text-fg-muted">
          <Link href="/profile" className="link">
            {COPY.importTranscript}
          </Link>{" "}
          to see which courses you can take.
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 max-md:flex-col max-md:items-stretch max-md:gap-2">
        <SearchField
          ref={input}
          className="w-80 shrink-0 max-md:w-full"
          value={query.q}
          onChange={(q) => update({ q })}
          placeholder="Search courses"
          shortcut="/"
        />
        {/* On a phone the chips scroll sideways inside their own row, edge to edge, fading out at the edges. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:-mx-4 max-md:-my-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:py-1 max-md:[mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-1rem),transparent)]">
          {PROPS.map((prop) => (
            <FilterPopover
              key={prop}
              prop={prop}
              options={optionsOf(prop, b)}
              selected={query.filters[prop]}
              onChange={(values) =>
                update({ filters: { ...query.filters, [prop]: values } })
              }
              open={open === prop}
              onOpenChange={(next) =>
                setOpen((now) => (next ? prop : now === prop ? null : now))
              }
            />
          ))}
        </div>
      </div>

      <div
        className="mt-6"
        {...(b.hasProfile && {
          role: "tabpanel",
          id: PANEL,
          "aria-labelledby": `${PANEL}-${query.view}`,
        })}
      >
        {rows.length === 0 ? (
          <div>
            <h2>No courses match</h2>
            {(searching || filtering) && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => update({ q: "", filters: NO_FILTERS })}
              >
                {searching && filtering
                  ? "Clear search and filters"
                  : searching
                    ? "Clear search"
                    : "Clear filters"}
              </Button>
            )}
          </div>
        ) : (
          <>
            <Card className="overflow-hidden md:hidden">
              <ul aria-label="Courses">
                {shown.map((course) => (
                  <CourseListRow
                    key={course.code}
                    course={course}
                    b={b}
                    status={statuses}
                  />
                ))}
              </ul>
            </Card>
            <Card className="overflow-hidden max-md:hidden">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <caption className="sr-only">Courses</caption>
                <colgroup>
                  {/* A tablet narrows the code and status columns to give titles room. */}
                  <col className="w-37 max-lg:w-28" />
                  <col />
                  {statuses && <col className="w-40 max-lg:w-32" />}
                  <col className="w-24" />
                  <col className="w-27" />
                </colgroup>
                <thead>
                  <tr className="h-9 text-left text-fg-muted">
                    <th className={HEAD}>Course</th>
                    <th className={HEAD}>
                      <span className="sr-only">Title</span>
                    </th>
                    {statuses && <th className={HEAD}>Status</th>}
                    <th className={cn(HEAD, "text-right")}>
                      <Term def={GLOSSARY.credits} />
                    </th>
                    <th className={HEAD}>
                      <Term def={GLOSSARY.offered} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((course) => (
                    <CourseTableRow
                      key={course.code}
                      course={course}
                      b={b}
                      status={statuses}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
            <div
              className={cn(
                "flex items-center justify-between",
                pages > 1 && "mt-4",
              )}
            >
              <p
                aria-live="polite"
                className={cn(
                  "text-fg-muted tabular-nums",
                  pages === 1 && "sr-only",
                )}
              >
                {first + 1}-{first + shown.length} of{" "}
                {rows.length.toLocaleString("en-CA")}
              </p>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    icon
                    aria-label="Previous page"
                    className="max-md:size-11"
                    disabled={current === 1}
                    onClick={() => goTo(current - 1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    variant="secondary"
                    icon
                    aria-label="Next page"
                    className="max-md:size-11"
                    disabled={current >= pages}
                    onClick={() => goTo(current + 1)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A click anywhere on the row opens the course. The code is a real link for the keyboard and for middle-click. */
function CourseTableRow({
  course,
  b,
  status: showStatus,
}: {
  course: CourseSummary;
  b: Browse;
  status: boolean;
}) {
  const router = useRouter();
  const href = `/courses/${courseSlug(course.code)}`;
  const { state, status, word } = rowStatus(course, b);
  return (
    <tr
      onClick={(event) => {
        if (!(event.target as Element).closest("a, button")) router.push(href);
      }}
      className="group h-11 cursor-pointer"
    >
      <td className={CELL}>
        <Link
          href={href}
          prefetch={false}
          className="-my-3 flex rounded-md py-3 font-semibold tabular-nums focus-visible:-outline-offset-2"
        >
          <CourseCode code={course.code} />
        </Link>
      </td>
      <td className={CELL}>
        <span className="flex min-w-0 items-start gap-2">
          <span className="truncate" title={course.title}>
            {course.title}
          </span>
          {state?.uncertain && <UncertainFlag />}
        </span>
      </td>
      {showStatus && (
        <td className={CELL}>
          <StatusTip
            status={status}
            word={word}
            reason={statusDetail(course, state, b)}
            className="flex w-fit"
          >
            <StatusBadge status={status} word={word && "Not offered"} />
          </StatusTip>
        </td>
      )}
      <td className={cn(CELL, "whitespace-nowrap text-right tabular-nums")}>
        <CreditsLabel course={course} bare />
      </td>
      <td className={CELL}>
        <SeasonLetters course={course} quiet={showStatus} />
      </td>
    </tr>
  );
}

/** The row's catalogue state, status and word. A course that does not run this year never reads "Can take" (D33). */
function rowStatus(course: CourseSummary, b: Browse) {
  const status = statusOf(b.states, course.code);
  const word =
    status === "available" && seasonsOffered(course) === COPY.notOfferedYear
      ? COPY.notOfferedYear
      : undefined;
  return { state: b.states.get(course.code), status, word };
}

/** The phone's course row: code and title, then status, credits and seasons on a muted line. The whole row opens the course. */
function CourseListRow({
  course,
  b,
  status: showStatus,
}: {
  course: CourseSummary;
  b: Browse;
  status: boolean;
}) {
  const { state, status, word } = rowStatus(course, b);
  const offered = seasonsOffered(course);
  const seasons =
    offered !== COPY.notOfferedYear
      ? offered
      : !(showStatus && word) && "Not offered";
  return (
    <li className="relative border-line border-t px-4 py-3 first:border-t-0 focus-within:bg-tint hover:bg-tint active:bg-tint">
      <span className="flex items-start gap-2">
        <Link
          href={`/courses/${courseSlug(course.code)}`}
          prefetch={false}
          className="flex min-w-0 flex-1 gap-3 rounded-md after:absolute after:inset-0"
        >
          <span className="shrink-0 font-semibold tabular-nums">
            <CourseCode code={course.code} />
          </span>
          <span className="min-w-0">{course.title}</span>
        </Link>
        {state?.uncertain && (
          <span className="relative flex">
            <UncertainFlag />
          </span>
        )}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-fg-muted tabular-nums">
        {showStatus && (
          <>
            <StatusIcon status={status} />
            <span style={{ color: STATUS[status].text }}>
              {word ? "Not offered" : STATUS[status].label}
            </span>
            <span aria-hidden>·</span>
          </>
        )}
        <CreditsLabel course={course} />
        {seasons && (
          <>
            <span aria-hidden>·</span>
            {seasons}
          </>
        )}
      </span>
    </li>
  );
}
