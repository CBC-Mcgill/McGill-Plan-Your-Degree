"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Tooltip } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import {
  AddFilterMenu,
  FilterPopover,
  SearchField,
  SortMenu,
} from "@/components/course-filters";
import { BrowseSkeleton, seasonsOffered } from "@/components/course-row";
import { STATUS, StatusIcon, UncertainFlag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ViewTabs } from "@/components/ui/tabs";
import { useCatalogue } from "@/lib/catalogue/client";
import { searchCourses } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import {
  buildBase,
  type CatalogueBase,
  inView,
  NO_FILTERS,
  optionsOf,
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
  VIEWS,
  viewCounts,
} from "@/lib/engine/browse";
import { buildSnapshot, type Snapshot } from "@/lib/engine/snapshot";
import { courseStatus } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import type { CourseRecord, Plan } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { getProgram } from "@/lib/programs";
import { replaceUrl, useScrollMemory } from "@/lib/use-scroll-memory";

const PAGE_SIZE = 50;
const PANEL = "course-panel";
const PROMOTED: Prop[] = ["subject", "level", "term"];
const EXTRA: Prop[] = ["faculty", "credits"];
const TH = "px-2 font-medium";
const EMPTY = buildSnapshot([], [], null);

interface Browse extends CatalogueBase, Student {
  /** False for a visitor with no transcript or plan, who sees no statuses. */
  hasProfile: boolean;
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
  const programId = useProfileStore((state) => state.programId);
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const base = useMemo(
    () => (courses ? buildBase(courses.values()) : null),
    [courses],
  );
  const inProgram = useMemo(
    () =>
      base
        ? programCodes(
            programId ? getProgram(programId) : undefined,
            base.index,
          )
        : null,
    [base, programId],
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
    programSubjects,
    hasProfile: snapshot !== null,
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

/** Table with saved views: tabs with counts, promoted filter chips, a sort menu and 50 rows a page. The URL holds the whole query. */
function CourseTable({ b }: { b: Browse }) {
  const params = useSearchParams();
  const urlQuery = params.toString();
  const [query, setQuery] = useState(() => readQuery(params, b.hasProfile));
  const [seenUrl, setSeenUrl] = useState(urlQuery);
  const [added, setAdded] = useState(() => withValues(query));
  const [open, setOpen] = useState<Prop | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // A link back to /courses clears the URL from outside, so follow it. Our own writes already match the query.
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    if (urlQuery !== queryString(query, b.hasProfile)) {
      const next = readQuery(params, b.hasProfile);
      setQuery(next);
      setAdded(withValues(next));
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

  const counts = useMemo(() => viewCounts(b.index, b), [b]);
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

  // A URL the page cannot honor, such as page=999 or view=nope, is rewritten to what is shown.
  useEffect(() => {
    const canonical = queryString({ ...query, page: current }, b.hasProfile);
    if (canonical !== window.location.search.slice(1)) {
      replaceUrl(canonical ? `?${canonical}` : window.location.pathname);
    }
  }, [query, current, b.hasProfile]);

  /** Any change but the page number starts again from page 1. */
  function update(patch: Partial<Query>) {
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    const string = queryString(next, b.hasProfile);
    replaceUrl(string ? `?${string}` : window.location.pathname);
  }
  const setProp = (prop: Prop, values: string[]) =>
    update({ filters: { ...query.filters, [prop]: values } });
  const goTo = (page: number) => {
    update({ page });
    card.current?.scrollIntoView({ block: "start" });
  };

  const chip = (prop: Prop) => {
    const selected = query.filters[prop];
    const extra = EXTRA.includes(prop);
    return (
      <FilterPopover
        key={prop}
        prop={prop}
        options={optionsOf(prop, b)}
        selected={selected}
        onChange={(values) => setProp(prop, values)}
        onClear={
          extra
            ? () => {
                setProp(prop, []);
                setAdded((list) => list.filter((p) => p !== prop));
              }
            : selected.length
              ? () => setProp(prop, [])
              : undefined
        }
        open={open === prop}
        onOpenChange={(next) =>
          setOpen((now) => (next ? prop : now === prop ? null : now))
        }
      />
    );
  };
  const left = EXTRA.filter((prop) => !added.includes(prop));

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <Card ref={card} className="scroll-mt-6 overflow-hidden">
        <div className="flex h-12 items-center border-border border-b px-3">
          <ViewTabs
            label="Saved views"
            panelId={PANEL}
            value={query.view}
            onChange={(view) => update({ view })}
            tabs={(b.hasProfile ? VIEWS : VIEWS.slice(0, 1)).map((tab) => ({
              ...tab,
              count: counts[tab.value],
            }))}
          />
          <div className="ml-auto flex items-center gap-4">
            {!b.hasProfile && (
              <p className="text-[13px] text-muted-foreground">
                <Link
                  href="/profile"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  Import your transcript
                </Link>{" "}
                to see which courses you can take.
              </p>
            )}
            <SortMenu sort={query.sort} onChange={(sort) => update({ sort })} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
          <SearchField
            ref={input}
            className="min-w-40 max-w-[280px] flex-1"
            value={query.q}
            onChange={(q) => update({ q })}
            placeholder="Search courses"
            shortcut="/"
          />
          <div className="flex min-w-0 items-center gap-2">
            {PROMOTED.map(chip)}
            {added.map(chip)}
            {left.length > 0 && (
              <AddFilterMenu
                props={left}
                onPick={(prop) => {
                  setAdded((list) => [...list, prop]);
                  setOpen(prop);
                }}
              />
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          id={PANEL}
          aria-labelledby={`${PANEL}-${query.view}`}
        >
          {rows.length === 0 ? (
            <EmptyState
              onClear={() => {
                setAdded([]);
                update({
                  q: "",
                  filters: NO_FILTERS,
                  view: counts[query.view] === 0 ? "all" : query.view,
                });
              }}
            />
          ) : (
            <>
              <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">Courses</caption>
                <colgroup>
                  <col className="w-[148px]" />
                  <col />
                  <col className="w-20" />
                  <col className="w-40" />
                  <col className="w-[152px]" />
                </colgroup>
                <thead>
                  <tr className="h-9 border-border border-b bg-subtle text-left font-medium text-[12px] text-muted-foreground">
                    <th className={cn(TH, "pl-4")}>Course</th>
                    <th className={TH}>Title</th>
                    <th className={cn(TH, "text-right")}>Credits</th>
                    <th className={TH}>Offered</th>
                    <th className={cn(TH, "pr-4")}>
                      <span className="sr-only">Conditions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((course) => (
                    <CourseTableRow key={course.code} course={course} b={b} />
                  ))}
                </tbody>
              </table>
              <div className="flex h-12 items-center justify-between border-border border-t px-4">
                <p
                  aria-live="polite"
                  className="text-[13px] text-muted-foreground tabular-nums"
                >
                  {first + 1}-{first + shown.length} of{" "}
                  {rows.length.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    className="size-8 px-0"
                    aria-label="Previous page"
                    disabled={current === 1}
                    onClick={() => goTo(current - 1)}
                  >
                    <ChevronLeft aria-hidden strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="secondary"
                    className="size-8 px-0"
                    aria-label="Next page"
                    disabled={current >= pages}
                    onClick={() => goTo(current + 1)}
                  >
                    <ChevronRight aria-hidden strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </Tooltip.Provider>
  );
}

/** Extra filters that already hold values, so their chips show on load. */
const withValues = (query: Query) =>
  EXTRA.filter((prop) => query.filters[prop].length > 0);

/** A click anywhere on the row opens the course. The code is a real link for the keyboard and for middle-click. */
function CourseTableRow({ course, b }: { course: CourseSummary; b: Browse }) {
  const router = useRouter();
  const href = `/courses/${courseSlug(course.code)}`;
  const state = b.states.get(course.code);
  const status = statusOf(b.states, course.code);
  return (
    <tr
      onClick={(event) => {
        if (!(event.target as Element).closest("a")) router.push(href);
      }}
      className={cn(
        "h-10 cursor-pointer hover:bg-subtle",
        b.hasProfile && status === "locked" && "text-muted-foreground",
      )}
    >
      <td className="py-0 pr-2 pl-4">
        <div className="flex min-w-0 items-center gap-2">
          {b.hasProfile && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex size-5 shrink-0 items-center justify-center">
                  <StatusIcon status={status} label={STATUS[status].label} />
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  sideOffset={6}
                  className="z-[85] max-w-[260px] rounded-md bg-foreground px-2.5 py-1.5 text-[12px] text-white leading-4 shadow-float"
                >
                  <span className="font-semibold">{STATUS[status].label}</span>
                  <span className="block text-white/80">
                    {statusDetail(course, state, b)}
                  </span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          <Link
            href={href}
            prefetch={false}
            className="truncate rounded-sm font-semibold tabular-nums"
          >
            {course.code}
          </Link>
        </div>
      </td>
      <td className="truncate px-2" title={course.title}>
        {course.title}
      </td>
      <td className="px-2 text-right text-[13px] text-muted-foreground tabular-nums">
        {course.credits ?? "-"}
      </td>
      <td className="truncate px-2 text-[13px] text-muted-foreground">
        {seasonsOffered(course)}
      </td>
      <td className="pr-4 pl-2">
        {state?.uncertain && <UncertainFlag withLabel />}
      </td>
    </tr>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-subtle text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
        <SearchX aria-hidden className="size-5" strokeWidth={1.75} />
      </div>
      <h2 className="text-base/6">No courses match</h2>
      <p className="mt-1 max-w-[280px] text-balance text-muted-foreground">
        Try fewer filters or a different search.
      </p>
      <Button variant="secondary" className="mt-4" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
