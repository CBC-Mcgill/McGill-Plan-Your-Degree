"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import {
  FilterPopover,
  SearchField,
  SortMenu,
} from "@/components/course-filters";
import { BrowseSkeleton, seasonsOffered } from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import {
  STATUS,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
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
/** Cells share the row's hover and focus tint, so the row reads as one 44px line. */
const CELL = "pr-4 group-focus-within:bg-tint group-hover:bg-tint";

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

/** Views, filter chips, a sort menu and 50 rows a page. The URL holds the whole query. */
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
  const glyphs = b.hasProfile && query.view !== "can-take";

  return (
    <div ref={top} className="scroll-mt-6">
      {b.hasProfile ? (
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
      ) : (
        <p className="text-fg-muted">
          <Link href="/profile" className="link">
            {COPY.importTranscript}
          </Link>{" "}
          to see which courses you can take.
        </p>
      )}

      <div className="mt-4 flex items-center gap-4">
        <SearchField
          ref={input}
          className="w-80 shrink-0"
          value={query.q}
          onChange={(q) => update({ q })}
          placeholder="Search courses"
          shortcut="/"
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        {b.views.some((view) => view.value === "program") && (
          <div className="ml-auto">
            <SortMenu sort={query.sort} onChange={(sort) => update({ sort })} />
          </div>
        )}
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
                variant="text"
                className="mt-4 -ml-3"
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
            <table className="-mx-2 w-[calc(100%+1rem)] table-fixed border-separate border-spacing-0">
              <caption className="sr-only">Courses</caption>
              <colgroup>
                <col className={glyphs ? "w-36" : "w-30"} />
                <col />
                <col className="w-28" />
                <col className="w-48" />
              </colgroup>
              <thead>
                <tr className="h-9 text-left text-fg-muted">
                  <th className="pr-4 pl-2 font-normal">Course</th>
                  <th className="pr-4 font-normal">
                    <span className="sr-only">Title</span>
                  </th>
                  <th className="pr-4 text-right font-normal">
                    <Term def={GLOSSARY.credits} />
                  </th>
                  <th className="pr-2 font-normal">
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
                    glyph={glyphs}
                  />
                ))}
              </tbody>
            </table>
            <div
              className={cn(
                "flex items-center justify-between",
                pages > 1 && "mt-6",
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="text"
                    icon
                    aria-label="Previous page"
                    disabled={current === 1}
                    onClick={() => goTo(current - 1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    variant="text"
                    icon
                    aria-label="Next page"
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
  glyph,
}: {
  course: CourseSummary;
  b: Browse;
  glyph: boolean;
}) {
  const router = useRouter();
  const href = `/courses/${courseSlug(course.code)}`;
  const state = b.states.get(course.code);
  const status = statusOf(b.states, course.code);
  const offered = seasonsOffered(course);
  // A course that does not run this year never reads "Can take" (D33).
  const word =
    status === "available" && offered === COPY.notOfferedYear
      ? COPY.notOfferedYear
      : undefined;
  const link = (
    <Link
      href={href}
      prefetch={false}
      className="-my-3 truncate rounded-md py-3 font-semibold tabular-nums focus-visible:-outline-offset-2"
    >
      {course.code}
    </Link>
  );
  return (
    <tr
      onClick={(event) => {
        if (!(event.target as Element).closest("a, button")) router.push(href);
      }}
      className="group h-11 cursor-pointer"
    >
      <td className={cn(CELL, "rounded-l-md pl-2")}>
        {glyph ? (
          <StatusTip
            status={status}
            word={word}
            reason={statusDetail(course, state, b)}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="flex w-4 shrink-0 items-center">
              <StatusIcon
                status={status}
                label={word ?? STATUS[status].label}
              />
            </span>
            {link}
          </StatusTip>
        ) : (
          <div className="flex min-w-0">{link}</div>
        )}
      </td>
      <td className={CELL}>
        <span className="flex min-w-0 items-start gap-2">
          <span className="truncate" title={course.title}>
            {course.title}
          </span>
          {state?.uncertain && <UncertainFlag />}
        </span>
      </td>
      <td
        className={cn(
          CELL,
          "whitespace-nowrap text-right text-fg-muted tabular-nums",
        )}
      >
        <CreditsLabel course={course} />
      </td>
      <td
        className={cn(CELL, "truncate rounded-r-md pr-2 text-fg-muted")}
        title={offered}
      >
        {offered}
      </td>
    </tr>
  );
}
