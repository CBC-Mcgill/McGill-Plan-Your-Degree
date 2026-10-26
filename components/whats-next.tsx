"use client";

import { cn } from "cn";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertDialog } from "radix-ui";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { TermItem, useStarts } from "@/components/add-to-plan";
import { CatalogueError } from "@/components/catalogue-error";
import { CourseCode } from "@/components/course-code";
import {
  ROW,
  ROW_LINK,
  ROW_TITLE,
  seasonsOffered,
} from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import { CatalogueLink, VsbLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { NoProfile } from "@/components/no-profile";
import { CourseSearch, type PickState } from "@/components/plan/add-course";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import {
  BAR_WITH_LEGEND,
  ProgramBars,
  RoomLeft,
} from "@/components/program-bars";
import {
  STATUS,
  type Status,
  StatusBadge,
  StatusBar,
  StatusIcon,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { CARD, Card } from "@/components/ui/card";
import { Disclosure, ShowMore } from "@/components/ui/disclosure";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { Term as Defined } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { requirementSplit, requirementsMet } from "@/lib/engine/credits";
import {
  type Entry,
  EXTRA_KEY,
  groupKeys,
  type Item,
  type NextView,
  nextView,
  ruleTitle,
  SECOND_KEY,
  termSnapshot,
} from "@/lib/engine/next-view";
import {
  type Claimed,
  type CreditSplit,
  checkKey,
  countedInstead,
  creditSplit,
  type GroupProgress,
  type ProgramProgress,
  picksOne,
  programSplit,
  programStanding,
  replaceKey,
  secondOverlaps,
  splitCourses,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { courseStatus } from "@/lib/engine/status";
import { sentence } from "@/lib/format";
import {
  type Definition,
  GLOSSARY,
  PAIR_TIPS,
  shareDefinition,
} from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  pastTermOptions,
  planTermOptions,
  termLabel,
} from "@/lib/profile/term-options";
import {
  type CourseRecord,
  doneStatus,
  isMarked,
  type Plan,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram, useSeconds } from "@/lib/programs/client";
import { type Pair, pairOf } from "@/lib/programs/minor";
import type { Program } from "@/lib/programs/types";

const BUCKET_LIMIT = 5;
const OTHER_LIMIT = 20;

// The catalogue opens a program page on its overview tab, and this hash opens the course lists instead.
const coursesTab = (source: string) => `${source}#coursestext`;

const courseCount = (n: number) =>
  `${n.toLocaleString("en-CA")} ${n === 1 ? "course" : "courses"}`;
const dot = <span aria-hidden> · </span>;

/** How a course stands for this student, and the term it was taken or is planned in. */
interface Fact {
  status: Status;
  term: Term | null;
}

interface Context {
  catalogue: Catalogue;
  /** With the plan, for the status of a course the student searches for. */
  snapshot: Snapshot;
  term: Term;
  /** Course code to the term the plan starts it in. */
  planned: ReadonlyMap<string, Term>;
  facts: ReadonlyMap<string, Fact>;
  /** Courses the program lists or counts, so the second program's rows for them say they count for both. */
  both?: ReadonlySet<string>;
  /** The program's courses past the second program's overlap cap, which count for the program only. */
  programOnly?: ReadonlySet<string>;
  /** The second program's overlap cap, for the tooltips. */
  cap?: number;
  /** How the second program pairs with the program, for the share labels. */
  pair?: Pair;
  /** Keeps the pane the rows sit in open, so meeting its last rule does not open the next one. */
  keepPane?: () => void;
}

type Heading = "h3" | "h4";

/** One entry of the requirement list and the pane it opens. */
interface Pane {
  /** The `req` search param that opens it. */
  key: string;
  label: string;
  /** A met requirement, ticked in the list. */
  done?: boolean;
  /** The fraction beside the bar, or the line under the label. */
  side: string;
  split?: CreditSplit & { total: number };
  checks?: number;
  body: ReactNode;
}

export function WhatsNext() {
  const snapshot = useSnapshot();
  if (snapshot === null) {
    return (
      <NoProfile
        title="See what you can take next"
        lede="Import your unofficial transcript to see the courses you can take next term and what you still need to graduate."
        sample="next"
      />
    );
  }
  if (snapshot === undefined) return <PageSkeleton />;
  return <Ready snapshot={snapshot} />;
}

// Split out so a visitor without a profile does not download the catalogue.
function Ready({ snapshot }: { snapshot: Snapshot }) {
  const programId = useProfileStore((state) => state.programId);
  const catalogue = useCatalogue();
  const program = useProgram(programId);
  const seconds = useSeconds();
  if (catalogue.status === "error") {
    return (
      <>
        <h1 className="sr-only">What's next</h1>
        <CatalogueError />
      </>
    );
  }
  if (
    catalogue.status !== "ready" ||
    program === undefined ||
    seconds === undefined
  ) {
    return <PageSkeleton />;
  }
  return (
    <Page
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
      seconds={seconds}
    />
  );
}

function Page({
  snapshot,
  catalogue,
  program,
  seconds,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  /** The second program, then the extra minor. */
  seconds: readonly Program[];
}) {
  const entry = useProfileStore((state) => state.entry);
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const paneId = useId();
  const panes = useRef<HTMLDivElement>(null);
  const asked = useSearchParams().get("req");
  const [kept, keep] = useState<string | null>(null);
  // Opening a pane or going back to the list removes what had focus, so focus moves to the new view once it renders.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const target =
      focusNext.current && document.getElementById(focusNext.current);
    if (target) {
      target.focus();
      focusNext.current = null;
    }
  });

  const term = useMemo(() => planTermOptions([])[0] ?? currentTerm(), []);

  const planned = useMemo(
    () =>
      new Map(
        plan.flatMap(({ term, courses }) =>
          courses.map((code) => [code, term] as const),
        ),
      ),
    [plan],
  );
  const facts = useMemo(
    () => courseFacts(records, plan, snapshot),
    [records, plan, snapshot],
  );
  const judged = useMemo(
    () => termSnapshot(snapshot, plan, term),
    [snapshot, plan, term],
  );
  // Not counted and the bars read the plan too, so a planned course shows before the student takes it.
  const withPlan = useMemo(
    () =>
      program
        ? programStanding(program, snapshot, catalogue, entry, "plan")
        : null,
    [program, snapshot, catalogue, entry],
  );
  const view = useMemo(
    () =>
      nextView(catalogue, judged, term, program, entry, undefined, withPlan),
    [catalogue, judged, term, program, entry, withPlan],
  );
  const overlaps = useMemo(
    () =>
      secondOverlaps(seconds, program, judged, catalogue, entry, "counting"),
    [seconds, program, judged, catalogue, entry],
  );
  const secondsWithPlan = useMemo(() => {
    const withPlanOverlaps = secondOverlaps(
      seconds,
      program,
      snapshot,
      catalogue,
      entry,
      "plan",
    );
    return seconds.map((second, i) =>
      programStanding(
        second,
        snapshot,
        catalogue,
        entry,
        "plan",
        withPlanOverlaps[i]?.programOnly,
      ),
    );
  }, [seconds, program, snapshot, catalogue, entry]);
  const secondViews = useMemo(
    () =>
      seconds.map((second, i) =>
        nextView(
          catalogue,
          judged,
          term,
          second,
          entry,
          overlaps[i]?.programOnly,
          secondsWithPlan[i],
        ),
      ),
    [catalogue, judged, term, seconds, entry, overlaps, secondsWithPlan],
  );
  const unclaimed = withPlan?.unclaimed ?? [];
  const context: Context = { catalogue, snapshot, term, planned, facts };
  const pair = pairOf(program, seconds[0] ?? null);

  if (!program || !view.progress) {
    return (
      <>
        <h1 className="sr-only">What's next</h1>
        <p>
          <Link href="/profile#program" className="link font-semibold">
            {COPY.pickProgram}
          </Link>{" "}
          to see what you still need.
        </p>
        <div className="mt-6 max-md:[&_h2]:text-base">
          <OtherCourses entries={view.other} context={context} />
        </div>
      </>
    );
  }

  const { creditsDone, credits, groups } = view.progress;
  const [met, needed] = requirementsMet(view.progress);
  const keys = groupKeys(groups);
  const when = termLabel(term);
  const requirements: Pane[] = groups.map((group, index) => {
    const split = withPlan?.groups[index];
    const counts = countsCredits(group);
    const key = keys[index] ?? String(index);
    return {
      key,
      label: sentence(group.title),
      done: group.satisfied,
      side: group.credited
        ? "Credited from CEGEP"
        : group.confirmed
          ? COPY.checkedByYou
          : counts
            ? groupCount(group)
            : group.kind === "required"
              ? `${group.coursesDone} of ${courseCount(group.coursesDone + group.remaining.length)}`
              : checksText(group.unparsed),
      split:
        !group.satisfied && counts && split
          ? { ...creditSplit(split, snapshot, top(group)), total: top(group) }
          : undefined,
      checks: group.unparsed,
      body: (
        <GroupPane
          group={group}
          index={index}
          split={split}
          program={program}
          view={view}
          snapshot={snapshot}
          context={{ ...context, keepPane: () => keepPane(key) }}
        />
      ),
    };
  });
  seconds.forEach((second, i) => {
    const secondView = secondViews[i];
    const secondWithPlan = secondsWithPlan[i] ?? null;
    const overlap = overlaps[i];
    const progress = secondView?.progress;
    if (!secondView || !progress) return;
    const key = i === 0 ? SECOND_KEY : EXTRA_KEY;
    // The extra minor shares with the program and the second program, both counted before it.
    const others = new Set(
      [view, ...secondViews.slice(0, i)].flatMap((earlier) => [
        ...programCodes(earlier),
      ]),
    );
    requirements.push({
      key,
      label: COPY.secondTitle(second),
      done: progress.satisfied,
      side: `${progress.creditsDone} of ${progress.credits}`,
      split:
        !progress.satisfied && secondWithPlan
          ? {
              ...programSplit(secondWithPlan, snapshot),
              total: secondWithPlan.credits,
            }
          : undefined,
      checks: progress.groups.reduce((sum, group) => sum + group.unparsed, 0),
      body: (
        <MinorPane
          minor={second}
          view={secondView}
          withPlan={secondWithPlan}
          snapshot={snapshot}
          context={{
            ...context,
            // Once the cap is used, a course still to take would count for the program only.
            both:
              overlap && overlap.left <= 0
                ? overlap.shared
                : without(others, overlap?.programOnly),
            programOnly: overlap?.programOnly,
            cap: overlap?.cap,
            pair: i === 0 ? pair : "extra",
            keepPane: () => keepPane(key),
          }}
        />
      ),
    });
  });
  const extras: Pane[] = [
    ...(unclaimed.length > 0
      ? [
          {
            key: "not-counted",
            label: "Not counted",
            side: courseCount(unclaimed.length),
            body: (
              <NotCounted
                courses={unclaimed}
                context={context}
                reasonFor={(code) => {
                  const pick =
                    withPlan && countedInstead(program, withPlan, code);
                  return pick ? COPY.countsInstead(pick.instead) : undefined;
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: "other",
      label: `Other courses in ${when}`,
      side: courseCount(view.other.length),
      body: <OtherPane entries={view.other} context={context} />,
    },
  ];
  const all = [...requirements, ...extras];
  // Below 1024px the list is the page until `?req=` opens one pane.
  const open = all.find((p) => p.key === asked);
  const pane =
    open ??
    all.find((p) => p.key === kept) ??
    requirements.find((p) => !p.done) ??
    all[0];

  function select(key: string, replace: boolean) {
    const url = `?req=${key}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    // From deep in a long pane, a short one would open above the fold.
    if ((panes.current?.getBoundingClientRect().top ?? 0) < 0) {
      panes.current?.scrollIntoView();
    }
  }

  // The router reads a new URL a render late, so `kept` holds the pane until then and the URL keeps it on reload.
  function keepPane(key: string) {
    keep(key);
    window.history.replaceState(null, "", `?req=${key}`);
  }

  function go(url: string, focus: string) {
    window.history.pushState(null, "", url);
    focusNext.current = focus;
    panes.current?.scrollIntoView();
  }

  const secondBars = seconds.flatMap((second, i) => {
    const progress = secondViews[i]?.progress;
    const secondWithPlan = secondsWithPlan[i];
    return progress && secondWithPlan
      ? [
          {
            label: COPY.secondTitle(second),
            done: progress.creditsDone,
            split: programSplit(secondWithPlan, snapshot),
            total: progress.credits,
            courses: splitCourses(secondWithPlan.groups, snapshot),
          },
        ]
      : [];
  });
  const [second] = seconds;

  return (
    <>
      <h1>{program.name}</h1>
      <p className="mt-2 text-fg-muted">
        {credits === 0 ? (
          <>
            <span className="tabular-nums">
              {met} of {needed}
            </span>{" "}
            <Defined def={GLOSSARY.requirementsMet} />
          </>
        ) : (
          <>
            {second && secondBars.length > 0 ? (
              COPY.pairCredits(pair, seconds[1] && COPY.extraLabel(second))
            ) : (
              <>
                <span className="tabular-nums">
                  {creditsDone} of {credits}
                </span>{" "}
                program credits
              </>
            )}{" "}
            <Defined def={GLOSSARY.earnedOrInProgress} />
          </>
        )}
        {dot}
        <CatalogueLink href={coursesTab(program.source)} />
        {program.generated && (
          <>
            {dot}
            <GeneratedNote hasChecks={hasChecks(program)} />
          </>
        )}
      </p>
      {withPlan && (
        <div className="mt-4">
          <ProgramBars
            program={
              credits === 0
                ? {
                    label: program.name,
                    done: met,
                    split: requirementSplit(withPlan, snapshot),
                    total: requirementsMet(withPlan)[1],
                    requirements: true,
                  }
                : {
                    label: COPY.pair[pair].labels[0],
                    done: creditsDone,
                    split: programSplit(withPlan, snapshot),
                    total: credits,
                    courses: splitCourses(withPlan.groups, snapshot),
                  }
            }
            seconds={secondBars}
          />
          <RoomLeft progress={view.progress} className="mt-2" />
        </div>
      )}
      <p className="mt-6">
        The lists mark what you can take in{" "}
        <span className="font-semibold">{termLabel(term)}</span>, your next term
        ·{" "}
        <Link href="/plan" className="link">
          Plan later terms
        </Link>{" "}
        · Sections and times in <VsbLink />
      </p>

      <div
        ref={panes}
        className="mt-6 grid scroll-mt-6 grid-cols-[15rem_minmax(0,1fr)] items-start gap-6 max-lg:block"
      >
        {pane && (
          <>
            <PaneList
              requirements={requirements}
              extras={extras}
              selected={pane.key}
              onSelect={select}
              paneId={paneId}
            />
            {!open && (
              <LinkList
                requirements={requirements}
                extras={extras}
                paneId={paneId}
                onOpen={(key) => go(`?req=${key}`, `${paneId}-back`)}
              />
            )}
            <div
              role="tabpanel"
              id={paneId}
              aria-labelledby={`${paneId}-${pane.key}`}
              className={cn(!open && "max-lg:hidden")}
            >
              {open && (
                <a
                  id={`${paneId}-back`}
                  href="/next"
                  onClick={(event) => {
                    event.preventDefault();
                    go("/next", `${paneId}-open-${open.key}`);
                  }}
                  className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-md pr-2 font-semibold lg:hidden"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                  All requirements
                </a>
              )}
              {pane.body}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** A required group of 0-credit courses, such as a comprehensive examination, counts courses instead. A group of rules to check counts credits once the student lists courses under one. */
const countsCredits = (group: GroupProgress) =>
  group.credits > 0 &&
  (group.kind === "required" ||
    group.rules.some((rule) => !rule.unparsed || rule.listed));

const checksText = (checks: number) =>
  checks === 1 ? "1 rule to check" : `${checks} rules to check`;

/** Every requirement with its bar, then Not counted and Other courses. Arrow keys, Home and End move between them. */
function PaneList({
  requirements,
  extras,
  selected,
  onSelect,
  paneId,
}: {
  requirements: Pane[];
  extras: Pane[];
  selected: string;
  onSelect: (key: string, replace: boolean) => void;
  paneId: string;
}) {
  const all = [...requirements, ...extras];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(event: React.KeyboardEvent) {
    const at = all.findIndex((pane) => pane.key === selected);
    const to = (
      {
        ArrowDown: Math.min(all.length - 1, at + 1),
        ArrowUp: Math.max(0, at - 1),
        Home: 0,
        End: all.length - 1,
      } as Record<string, number>
    )[event.key];
    const pane = to === undefined ? undefined : all[to];
    if (to === undefined || !pane || to === at) return;
    event.preventDefault();
    onSelect(pane.key, true);
    tabs.current[to]?.focus();
  }

  const tab = (pane: Pane, i: number) => {
    const isSelected = pane.key === selected;
    return (
      <button
        key={pane.key}
        ref={(element) => {
          tabs.current[i] = element;
        }}
        type="button"
        role="tab"
        id={`${paneId}-${pane.key}`}
        aria-selected={isSelected}
        aria-controls={paneId}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => !isSelected && onSelect(pane.key, false)}
        className={cn(
          "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1.5 rounded-md px-2 py-2 text-left hover:bg-tint focus-visible:-outline-offset-2",
          isSelected && "selected",
        )}
      >
        <PaneSummary pane={pane} />
      </button>
    );
  };

  return (
    <div
      className={cn(
        CARD,
        "sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto px-3 py-2 max-lg:hidden",
      )}
    >
      <div
        role="tablist"
        aria-label="Requirements"
        aria-orientation="vertical"
        onKeyDown={move}
      >
        {requirements.map(tab)}
        <div aria-hidden className="-mx-3 my-2 border-line border-t" />
        {extras.map((pane, i) => tab(pane, requirements.length + i))}
      </div>
    </div>
  );
}

/** A requirement's label with its tick and warn icon, then its bar and fraction or a line of text. */
function PaneSummary({ pane }: { pane: Pane }) {
  const checks = pane.checks ? checksText(pane.checks) : null;
  // Read after the fraction, unless the line under the label already says it.
  const said = checks && checks !== pane.side && (
    <span className="sr-only">, {checks}</span>
  );
  return (
    <>
      <span className="flex items-start gap-2 font-semibold">
        {pane.done && (
          <span className="flex h-5 items-center">
            <StatusIcon status="completed" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          {/* Keeps a short last word, as in "group B", off a line of its own. */}
          {pane.label.replace(/ (\S{1,2})$/, "\u00a0$1")}
        </span>
        {checks && (
          <span className="flex h-5 items-center">
            <TriangleAlert aria-hidden className="size-3.5 text-warn" />
          </span>
        )}
      </span>
      {pane.split ? (
        <span className="flex items-center gap-3 font-normal">
          <span aria-hidden className="min-w-0 flex-1">
            <StatusBar {...pane.split} />
          </span>
          <span className="shrink-0 text-fg-muted tabular-nums">
            {pane.side}
            {said}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "font-normal text-fg-muted tabular-nums",
            pane.done && "pl-6",
          )}
        >
          {pane.side}
          {said}
        </span>
      )}
    </>
  );
}

/** Below 1024px the requirement list is the page, and each row opens its pane. */
function LinkList({
  requirements,
  extras,
  paneId,
  onOpen,
}: {
  requirements: Pane[];
  extras: Pane[];
  paneId: string;
  onOpen: (key: string) => void;
}) {
  const item = (pane: Pane) => (
    <li key={pane.key} className="border-line border-t first:border-t-0">
      <a
        id={`${paneId}-open-${pane.key}`}
        href={`?req=${pane.key}`}
        onClick={(event) => {
          event.preventDefault();
          onOpen(pane.key);
        }}
        className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-tint focus-visible:-outline-offset-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <PaneSummary pane={pane} />
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-muted" />
      </a>
    </li>
  );
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      <ul aria-label="Requirements" className={cn(CARD, "overflow-hidden")}>
        {requirements.map(item)}
      </ul>
      <ul aria-label="More courses" className={cn(CARD, "overflow-hidden")}>
        {extras.map(item)}
      </ul>
    </div>
  );
}

/** The status and term of every course the student has done, is taking or planned. */
function courseFacts(
  records: readonly CourseRecord[],
  plan: Plan,
  snapshot: Snapshot,
): ReadonlyMap<string, Fact> {
  const facts = new Map<string, Fact>();
  for (const { term, courses } of plan) {
    for (const code of courses) facts.set(code, { status: "planned", term });
  }
  for (const [code, term] of snapshot.inProgress) {
    facts.set(code, { status: "in-progress", term });
  }
  for (const code of snapshot.done) {
    const shown = doneStatus(records, code);
    const record = records.find((r) => r.code === code && r.status === shown);
    facts.set(code, {
      status: snapshot.covered.has(code) ? "covered" : (shown ?? "completed"),
      term: record?.term ?? null,
    });
  }
  return facts;
}

const flatten = (items: Item[]) =>
  items.flatMap((item) => ("oneOf" in item ? item.oneOf : [item]));

const without = (codes: ReadonlySet<string>, drop?: ReadonlySet<string>) =>
  drop ? new Set([...codes].filter((code) => !drop.has(code))) : codes;

/** The share label on a second program's row: counts for both, or for the program only past the second program's cap. */
function shareFor(
  code: string,
  { both, programOnly, cap, pair }: Context,
): Definition | undefined {
  if (programOnly?.has(code)) return shareDefinition(true, cap, pair);
  if (both?.has(code)) return shareDefinition(false, cap, pair);
}

/** Every course the program still lists or already counts, so a second program's row for one of them counts for both. */
function programCodes(view: NextView): ReadonlySet<string> {
  return new Set([
    ...flatten([...view.mustTake, ...view.later]).map(
      ({ course }) => course.code,
    ),
    ...view.complementary.flatMap(({ buckets }) =>
      buckets.flatMap(({ entries }) =>
        entries.map(({ course }) => course.code),
      ),
    ),
    ...view.planned.flat().map(({ course }) => course.code),
    ...(view.progress?.groups ?? []).flatMap(({ courses }) =>
      courses.map(({ code }) => code),
    ),
  ]);
}

const hasChecks = (program: Program) =>
  program.groups.some(
    (group) =>
      group.kind === "complementary" &&
      group.rules.some((rule) => rule.unparsed),
  );

/** A range group counts courses up to the top of its range, past the credits it needs. */
const top = (group: GroupProgress) => group.maxCredits ?? group.credits;

/** "19 of 23", or "27 of 24 to 31" for a range group. */
const groupCount = (group: GroupProgress) =>
  `${Math.min(group.creditsDone, top(group))} of ${group.credits}${group.maxCredits === undefined ? "" : ` to ${group.maxCredits}`}`;

/** Rules to check, then credits, unless every rule needs a check and nothing can count. `split`, the same group counted with the plan, adds a small bar. */
function GroupMeta({
  group,
  split,
  snapshot,
}: {
  group: GroupProgress;
  split?: GroupProgress;
  snapshot?: Snapshot;
}) {
  const checks = group.unparsed;
  const counts = countsCredits(group);
  return (
    <span className="inline-flex items-center gap-4">
      {checks > 0 && (
        <span className="inline-flex items-center gap-2">
          <TriangleAlert aria-hidden className="size-4 text-warn" />
          {checksText(checks)}
        </span>
      )}
      {counts && `${groupCount(group)} credits`}
      {counts && split && snapshot && (
        <StatusBar
          {...creditSplit(split, snapshot, top(group))}
          total={top(group)}
          className="w-20"
        />
      )}
    </span>
  );
}

/** The bar of a pane: credits earned, in progress and planned, with their words. */
function Progress({
  courses,
  ...split
}: CreditSplit & {
  total: number;
  courses: Record<keyof CreditSplit, string[]>;
}) {
  return (
    <div className={BAR_WITH_LEGEND}>
      <StatusBar {...split} legend courses={courses} className="flex-1" />
    </div>
  );
}

/** Puts a pane card's meta under its title below 768px. */
const BAND_WRAPS =
  "max-md:[&>div:first-child]:flex-col max-md:[&>div:first-child]:items-start max-md:[&>div:first-child]:gap-1 max-md:[&>div:first-child>div]:ml-0";

/** A program group's pane: its bar, then its courses by status. */
function GroupPane({
  group,
  index,
  split,
  program,
  view,
  snapshot,
  context,
}: {
  group: GroupProgress;
  index: number;
  split: GroupProgress | undefined;
  program: Program;
  view: NextView;
  snapshot: Snapshot;
  context: Context;
}) {
  return (
    <Card
      title={sentence(group.title)}
      meta={<GroupMeta group={group} />}
      className={BAND_WRAPS}
    >
      <div className="flex flex-col gap-6">
        {!group.credited && countsCredits(group) && split && (
          <Progress
            {...creditSplit(split, snapshot, top(group))}
            total={top(group)}
            courses={splitCourses([split], snapshot)}
          />
        )}
        <GroupBody
          group={group}
          index={index}
          program={program}
          view={view}
          context={context}
          heading="h3"
        />
      </div>
    </Card>
  );
}

/** A heading over a list in a pane, with a hairline under it to the card's edges. */
function ListHeading({
  as: Tag,
  meta,
  children,
}: {
  as: Heading;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tag className="-mx-5 flex items-center gap-2 border-line border-b px-5 pb-2 font-semibold">
      {children}
      {meta && (
        <span className="ml-auto shrink-0 font-normal text-fg-muted tabular-nums">
          {meta}
        </span>
      )}
    </Tag>
  );
}

/** The courses of one status under its glyph, word and count. Nothing when it is empty. */
function Block({
  status,
  title,
  count,
  heading,
  children,
}: {
  status: Status;
  title: string;
  count: number;
  heading: Heading;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <ListHeading as={heading}>
        <StatusIcon status={status} />
        {title}{" "}
        <span className="font-normal text-fg-muted tabular-nums">
          {count.toLocaleString("en-CA")}
        </span>
      </ListHeading>
      {children}
    </div>
  );
}

/** What a group needs and counts: blocks by status for a required group, one list per rule for a complementary one. */
function GroupBody({
  group,
  index,
  program,
  view,
  context,
  heading,
}: {
  group: GroupProgress;
  index: number;
  program: Program;
  view: NextView;
  context: Context;
  heading: Heading;
}) {
  const definition = program.groups[index];
  const note = definition?.note && (
    <p className="text-fg-muted">{definition.note}</p>
  );
  if (group.credited) {
    const codes =
      definition?.kind === "required"
        ? definition.courses.flatMap((item) =>
            typeof item === "string" ? [item] : item.oneOf,
          )
        : [];
    return (
      <>
        <p className="text-fg-muted">
          Your Quebec CEGEP diploma credits this group, so you do not take these
          courses.
        </p>
        <Block
          status="covered"
          title="Covered"
          count={codes.length}
          heading={heading}
        >
          <ul>
            {codes.map((code) => (
              <PaneRow
                key={code}
                course={context.catalogue.get(code) ?? stub(code)}
                note="Credited from CEGEP"
              />
            ))}
          </ul>
        </Block>
      </>
    );
  }
  if (group.kind === "required") {
    return (
      <>
        {note}
        <RequiredBlocks
          group={group}
          view={view}
          context={context}
          heading={heading}
        />
      </>
    );
  }
  const open = view.complementary.find((g) => g.index === index);
  // A met group keeps only the rules the student checked, so they can take the mark back.
  const checks =
    definition?.kind === "complementary"
      ? definition.rules.flatMap((rule, i) =>
          rule.unparsed && (!group.satisfied || group.rules[i]?.confirmed)
            ? [{ rule, i, key: checkKey(program, definition, rule) }]
            : [],
        )
      : [];
  const planned = view.planned[index] ?? [];
  return (
    <>
      {note}
      {group.replaces && (
        <p className="text-fg-muted">
          Any course can make up the credits of a course exempted without
          credit. Check your choice with your advisor.
        </p>
      )}
      {group.replaces?.some(
        ({ code }) => context.facts.get(code)?.status === "waived",
      ) && <p className="text-fg-muted">{COPY.waiverReminder}</p>}
      {group.replaces && (
        <RuleCourses
          ruleKey={replaceKey(program)}
          listed={group.rules[0]?.listed ?? []}
          context={context}
        />
      )}
      {definition?.kind === "complementary" &&
        picksOne(definition) &&
        !open?.buckets.some((bucket) => bucket.stream) && (
          <p className="text-fg-muted">{COPY.pickOne}</p>
        )}
      {!open &&
        !group.satisfied &&
        definition?.kind === "complementary" &&
        definition.rules.map(
          (rule, i) =>
            !rule.adviser &&
            !rule.unparsed && (
              // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share a title and the list never reorders
              <p key={i} className="text-fg-muted">
                {ruleTitle(rule)}
              </p>
            ),
        )}
      <Block
        status="planned"
        title="Planned"
        count={planned.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={planned} context={context} plannedBlock />
        </ul>
      </Block>
      {group.replaces && (
        <Block
          status="exemption"
          title="Exempted without credit"
          count={group.replaces.length}
          heading={heading}
        >
          <ul>
            {group.replaces.map(({ code }) => (
              <CountedRow
                key={code}
                claimed={{ code, credits: 0 }}
                context={context}
              />
            ))}
          </ul>
        </Block>
      )}
      {open?.buckets.map((bucket, i) => (
        <Fragment key={bucket.title}>
          {/* Before the first stream's list, so lists every stream shares do not read as streams. */}
          {bucket.stream && !open.buckets[i - 1]?.stream && (
            <p className="text-fg-muted">{COPY.pickOne}</p>
          )}
          <Bucket
            title={bucket.title}
            progress={bucket.progress}
            entries={bucket.entries}
            context={context}
            heading={heading}
          />
        </Fragment>
      ))}
      {checks.length > 0 && (
        <ul>
          {checks.map(({ rule, i, key }) => (
            <CheckRow
              key={key}
              text={ruleTitle(rule)}
              source={program.source}
              ruleKey={key}
              confirmed={group.rules[i]?.confirmed === true}
              listed={group.rules[i]?.listed ?? []}
              context={context}
            />
          ))}
        </ul>
      )}
      {definition?.kind === "complementary" &&
        group.rules.some((rule) => rule.adviser) && (
          <ul>
            {definition.rules.map(
              (rule, i) =>
                rule.adviser &&
                (rule.option === undefined || rule.option === group.option) && (
                  <AdviserRow
                    key={checkKey(program, definition, rule)}
                    text={rule.title}
                    ruleKey={checkKey(program, definition, rule)}
                    listed={group.rules[i]?.listed ?? []}
                    context={context}
                  />
                ),
            )}
          </ul>
        )}
      <Counted courses={group.courses} context={context} heading={heading} />
    </>
  );
}

/** Planned, can take and not open in the term, then the courses it counts. */
function RequiredBlocks({
  group,
  view,
  context,
  heading,
}: {
  group: GroupProgress;
  view: NextView;
  context: Context;
  heading: Heading;
}) {
  const mine = new Set(
    group.remaining.flatMap((item) =>
      typeof item === "string" ? [item] : item.oneOf,
    ),
  );
  const owns = (item: Item) =>
    flatten([item]).some(({ course }) => mine.has(course.code));
  const isPlanned = (item: Item) =>
    flatten([item]).some(({ course }) => context.planned.has(course.code));
  const ready = view.mustTake.filter(owns);
  const later = view.later.filter(owns);
  const open = ready.filter((item) => !isPlanned(item));
  const planned = [...ready, ...later].filter(isPlanned);
  const blocked = later.filter((item) => !isPlanned(item));
  const when = termLabel(context.term);
  return (
    <>
      <Block
        status="planned"
        title="Planned"
        count={planned.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={planned} context={context} plannedBlock />
        </ul>
      </Block>
      <Block
        status="available"
        title={`Can take in ${when}`}
        count={open.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={open} context={context} waivable />
        </ul>
      </Block>
      <Block
        status="locked"
        title={`Not open in ${when}`}
        count={blocked.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={blocked} context={context} waivable />
        </ul>
      </Block>
      <Counted courses={group.courses} context={context} heading={heading} />
    </>
  );
}

function ItemRows({
  items,
  context,
  plannedBlock,
  waivable,
}: {
  items: Item[];
  context: Context;
  plannedBlock?: boolean;
  /** A required course still to take, which the student may mark as waived. */
  waivable?: boolean;
}) {
  return items.map((item) =>
    "oneOf" in item ? (
      <li
        key={item.oneOf.map(({ course }) => course.code).join()}
        className="-mx-5 border-line border-t px-5 pt-3 first:border-t-0"
      >
        <p className="pb-1 text-fg-muted">Take one of these</p>
        <ul>
          {item.oneOf.map((entry) => (
            <Row
              key={entry.course.code}
              entry={entry}
              context={context}
              plannedBlock={plannedBlock}
              waivable={waivable}
            />
          ))}
        </ul>
      </li>
    ) : (
      <Row
        key={item.course.code}
        entry={item}
        context={context}
        plannedBlock={plannedBlock}
        waivable={waivable}
      />
    ),
  );
}

// A row that moves to another block takes focus with it, to the button of this name there.
const focusLater = (name: string) =>
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(`[aria-label="${CSS.escape(name)}"]`)
      ?.focus(),
  );

/** The button gives way to another in its place, so focus moves to the first button there once it renders. */
const focusInPlace = (button: Element | null) => {
  const slot = button?.parentElement;
  requestAnimationFrame(() => slot?.querySelector("button")?.focus());
};

// A row button stays 36px tall, its target grown to 44px where actions always show.
const HIT_AREA =
  "max-lg:relative max-lg:after:absolute max-lg:after:-inset-y-1 max-lg:after:inset-x-0";

const markWaived = (code: string) => `${COPY.markWaived} ${code}`;
const undoWaiver = (code: string) => `${COPY.undo} ${code} waiver`;

/** A course still to take: open with Add, planned with Remove in its own term, or not open with why. Under the Planned heading the term alone says it. */
function Row({
  entry: { course, uncertain, reason },
  context,
  plannedBlock = false,
  waivable = false,
}: {
  entry: Entry;
  context: Context;
  plannedBlock?: boolean;
  waivable?: boolean;
}) {
  const setWaived = useProfileStore((state) => state.setWaived);
  const { term, planned } = context;
  const plannedIn = planned.get(course.code);
  const here = plannedIn !== undefined && termKey(plannedIn) === termKey(term);
  const when = termLabel(term);
  const label = (add: boolean) =>
    `${add ? "Add" : "Remove"} ${course.code} ${add ? "to" : "from"} ${when}`;

  function toggle() {
    if (here) removeWithUndo(term, course.code);
    else addWithUndo(term, course.code);
    focusLater(label(here));
  }

  function waive() {
    context.keepPane?.();
    setWaived(course.code, true);
    focusLater(undoWaiver(course.code));
  }

  return (
    <PaneRow
      course={course}
      uncertain={uncertain}
      share={shareFor(course.code, context)}
      note={
        plannedIn
          ? plannedBlock
            ? termLabel(plannedIn)
            : COPY.plannedFor(plannedIn)
          : (reason ?? `Offered ${seasonsOffered(course)}`)
      }
      mark={
        waivable &&
        !plannedIn && (
          <Button
            variant="ghost"
            aria-label={markWaived(course.code)}
            onClick={waive}
            className={HIT_AREA}
          >
            {COPY.markWaived}
          </Button>
        )
      }
      action={
        here || (!plannedIn && !reason) ? (
          <Button
            variant="secondary"
            aria-label={label(!here)}
            onClick={toggle}
            className={HIT_AREA}
          >
            {here ? "Remove" : "Add"}
          </Button>
        ) : null
      }
    />
  );
}

/** A course row of a pane: code and title, "Counts for both" when it does, a note column that keeps its width so notes line up at 1024 too, credits, and the action on hover. Below 1024px the title wraps and the action always shows, and below 768px the code, title and note stack with credits and the action on the right. */
function PaneRow({
  course,
  uncertain = false,
  share,
  note,
  mark,
  action,
}: {
  course: CourseSummary;
  uncertain?: boolean;
  /** On a second program's row: counts for both, or for the program only. */
  share?: Definition;
  note: ReactNode;
  /** "Mark as waived" or "Mark as taken" before the action. On hover it takes the credits' place. Where actions always show, the two share a line under the row, and on a phone they follow the note when it leaves room. */
  mark?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li
      className={cn(
        ROW,
        // An open menu takes focus out of the row, so the row stays as hover left it.
        "has-[[data-state=open]]:bg-tint",
        mark
          ? "flex-wrap gap-y-2 max-md:gap-x-3 max-md:gap-y-0"
          : "max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1",
      )}
    >
      <span
        className={cn(
          ROW_TITLE,
          "max-md:col-start-1 max-md:row-start-1 max-md:items-end",
        )}
      >
        <Link
          href={`/courses/${courseSlug(course.code)}`}
          prefetch={false}
          className={cn(ROW_LINK, "max-md:flex-col max-md:gap-0.5")}
        >
          <span className="w-24 shrink-0 font-semibold">
            <CourseCode code={course.code} />
          </span>
          <span
            className="min-w-0 truncate max-lg:whitespace-normal"
            title={course.title}
          >
            {course.title}
          </span>
        </Link>
        {uncertain && <UncertainFlag />}
        {share && (
          <span className="hidden shrink-0 text-fg-muted @3xl:inline">
            <Defined def={share} />
          </span>
        )}
      </span>
      <span
        className={cn(
          "flex w-50 shrink-0 flex-wrap items-start gap-x-2 gap-y-1 text-fg-muted @3xl:w-64 max-md:col-start-1 max-md:row-start-2 max-md:w-auto max-md:self-center",
          mark && "max-md:order-3 max-md:mt-1 max-md:shrink max-md:grow",
        )}
      >
        {note}
        {/* Too wide beside a title in a narrow row, so it moves under the note there. */}
        {share && (
          <span className="@3xl:hidden">
            <Defined def={share} />
          </span>
        )}
      </span>
      <span
        className={cn(
          "w-22 shrink-0 whitespace-nowrap text-right text-fg-muted tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:w-auto",
          // The margin keeps the action column's room once the buttons wrap below.
          mark &&
            "max-md:order-1 md:max-lg:mr-24 lg:pointer-coarse:mr-24 lg:pointer-fine:group-focus-within:opacity-0 lg:pointer-fine:group-hover:opacity-0 lg:pointer-fine:group-has-[[data-state=open]]:opacity-0",
        )}
      >
        <CreditsLabel course={course} />
      </span>
      {/* On a phone the note starts a line of its own. */}
      {mark && (
        <span
          aria-hidden
          className="hidden max-md:order-2 max-md:block max-md:basis-full"
        />
      )}
      <span
        className={cn(
          "-my-2 flex w-20 shrink-0 justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 max-lg:opacity-100 max-md:w-auto max-md:self-center pointer-coarse:opacity-100",
          // Positioned, so the buttons stay above the hidden credits they overlap.
          mark
            ? "relative gap-2 max-lg:my-0 max-lg:basis-full lg:pointer-coarse:my-0 lg:pointer-coarse:basis-full max-md:order-4 max-md:mt-1 max-md:ml-auto max-md:basis-auto"
            : "max-md:col-start-2 max-md:row-start-2",
        )}
      >
        {mark}
        {action}
      </span>
    </li>
  );
}

const stub = (code: string): CourseSummary => ({
  code,
  subject: code.split(" ")[0] ?? code,
  number: code.split(" ")[1] ?? "",
  title: code,
  credits: null,
  offeredBy: null,
  faculty: null,
  terms: [],
  prerequisites: null,
  corequisites: null,
  restrictions: null,
});

const byCode = (a: Claimed, b: Claimed) => (a.code < b.code ? -1 : 1);

/** A course a requirement counts, one no requirement counts or one the student listed, with the student's status and term for it. */
function CountedRow({
  claimed: { code, credits },
  context,
  mark,
  action,
  reason,
}: {
  claimed: Claimed;
  context: Context;
  mark?: ReactNode;
  action?: ReactNode;
  reason?: string;
}) {
  const setWaived = useProfileStore((state) => state.setWaived);
  const { catalogue, facts } = context;
  const { status, term } = facts.get(code) ?? { status: null, term: null };
  const course = catalogue.get(code) ?? stub(code);
  const waived = status === "waived";
  // An exemption, a waiver or a DEC equivalent meets the requirement, but its credits go to the replace group.
  const toReplace =
    (status === "exemption" || status === "covered" || waived) && course.credits
      ? `${COPY.credits(course.credits)} to replace`
      : null;
  return (
    <PaneRow
      course={{ ...course, credits }}
      share={shareFor(code, context)}
      note={
        <>
          {status ? (
            <StatusBadge
              status={status}
              word={waived ? COPY.waivedByYou : undefined}
            />
          ) : (
            <StatusBadge status="available" word={COPY.notTaken} />
          )}
          {term && <span>{termLabel(term)}</span>}
          {toReplace && <span>{toReplace}</span>}
          {reason && <span>{reason}</span>}
        </>
      }
      mark={mark}
      action={
        action ??
        (waived && (
          <Button
            variant="secondary"
            aria-label={undoWaiver(code)}
            onClick={() => {
              context.keepPane?.();
              setWaived(code, false);
              focusLater(markWaived(code));
            }}
            className={HIT_AREA}
          >
            {COPY.undo}
          </Button>
        ))
      }
    />
  );
}

/** The courses a group counts, each with its status and term. */
function Counted({
  courses: counted,
  context,
  heading,
}: {
  courses: Claimed[];
  context: Context;
  heading: Heading;
}) {
  return (
    <Block
      status="completed"
      title="Counted"
      count={counted.length}
      heading={heading}
    >
      <ul>
        {[...counted].sort(byCode).map((claimed) => (
          <CountedRow key={claimed.code} claimed={claimed} context={context} />
        ))}
      </ul>
    </Block>
  );
}

/** One rule's list: planned rows first, then at most five more until the student asks for the rest. */
function Bucket({
  title,
  progress,
  entries,
  context,
  heading,
}: {
  title: string;
  progress: string | null;
  entries: Entry[];
  context: Context;
  heading: Heading;
}) {
  const isPlanned = (entry: Entry) => context.planned.has(entry.course.code);
  const ordered = [
    ...entries.filter(isPlanned),
    ...entries.filter((entry) => !isPlanned(entry)),
  ];
  return (
    <div>
      <ListHeading as={heading} meta={progress}>
        {title}
      </ListHeading>
      <Rows entries={ordered} context={context} limit={BUCKET_LIMIT} />
    </div>
  );
}

/** Rows up to `limit`, the rest behind "Show N more". */
function Rows({
  entries,
  context,
  limit,
}: {
  entries: Entry[];
  context: Context;
  limit: number;
}) {
  const rows = (part: Entry[]) => (
    <ul>
      {part.map((entry) => (
        <Row key={entry.course.code} entry={entry} context={context} />
      ))}
    </ul>
  );
  const rest = entries.slice(limit);
  return (
    <>
      {rows(entries.slice(0, limit))}
      {rest.length > 0 && <ShowMore count={rest.length}>{rows(rest)}</ShowMore>}
    </>
  );
}

/** A rule's list sits under its text, its rows bleeding to the card's right edge only. */
const UNDER_RULE = "basis-full pl-6 [&_li]:-ml-2 [&_li]:pl-2";

/** A rule the crawler could not read. It shows the catalogue text, links to the program and lists the courses the student counts for it. It counts as met once the student marks it as checked, after they confirm their listed courses meet it. Below 1024px the button is 44px tall, and below 768px it moves under the list. */
function CheckRow({
  text,
  source,
  ruleKey,
  confirmed,
  listed,
  context,
}: {
  text: string;
  source: string;
  ruleKey: string;
  confirmed: boolean;
  listed: Claimed[];
  context: Context;
}) {
  const setChecked = useProfileStore((state) => state.setChecked);
  const textId = useId();
  const [asking, setAsking] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function mark(checked: boolean) {
    context.keepPane?.();
    setChecked(ruleKey, checked);
  }

  return (
    <li className="flex min-h-11 flex-wrap items-start gap-2 py-3">
      <span className="flex h-5 w-4 shrink-0 items-center">
        {confirmed ? (
          <StatusIcon status="completed" />
        ) : (
          <TriangleAlert aria-hidden className="size-4 text-warn" />
        )}
      </span>
      <p className="min-w-0 flex-1 max-md:basis-[calc(100%-1.5rem)]">
        <span className="font-semibold">
          <Defined
            def={confirmed ? GLOSSARY.checkedByYou : GLOSSARY.checkRequirement}
          />
        </span>
        <span className="text-fg-muted">
          {dot}
          <span id={textId}>{text}</span>
          {dot}
        </span>
        <CatalogueLink href={coursesTab(source)} />
      </p>
      <Button
        ref={button}
        variant="secondary"
        aria-describedby={textId}
        onClick={() =>
          confirmed
            ? mark(false)
            : listed.length > 0
              ? setAsking(true)
              : mark(true)
        }
        className="-my-2 max-lg:-my-3 max-lg:h-11 max-md:order-last max-md:my-0 max-md:ml-6"
      >
        {confirmed ? COPY.undo : COPY.markChecked}
      </Button>
      <RuleCourses
        ruleKey={ruleKey}
        listed={listed}
        describedBy={textId}
        context={context}
        className={UNDER_RULE}
      />
      <AlertDialog.Root open={asking} onOpenChange={setAsking}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none" />
          <AlertDialog.Content
            // With no trigger, focus goes back to the button by hand.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              button.current?.focus();
            }}
            className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-bg p-6 shadow-float transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
          >
            <AlertDialog.Title>{COPY.meetsRequirement}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-fg-muted">
              {text}
            </AlertDialog.Description>
            <ul aria-label={COPY.listedCourses} className="mt-4">
              {listed.map(({ code, credits }) => (
                <li
                  key={code}
                  className="flex gap-4 border-line border-t py-2 first:border-t-0"
                >
                  <span className="w-24 shrink-0 font-semibold">
                    <CourseCode code={code} />
                  </span>
                  <span className="min-w-0 flex-1 truncate max-md:whitespace-normal">
                    {context.catalogue.get(code)?.title}
                  </span>
                  <span className="shrink-0 text-fg-muted tabular-nums">
                    {COPY.credits(credits)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-line border-t pt-2 font-semibold tabular-nums">
              <span>Total</span>
              {COPY.credits(listed.reduce((sum, c) => sum + c.credits, 0))}
            </p>
            <div className="mt-6 flex justify-end gap-2 max-md:flex-col-reverse max-md:gap-3 max-md:[&>button]:h-11">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{COPY.notYet}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => mark(true)}>
                  {COPY.confirmChecked}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </li>
  );
}

/** A rule whose courses the student's adviser must approve. It counts like any rule, shows the catalogue text with a reminder and lists the courses the student counts for it. */
function AdviserRow({
  text,
  ruleKey,
  listed,
  context,
}: {
  text: string;
  ruleKey: string;
  listed: Claimed[];
  context: Context;
}) {
  const textId = useId();
  return (
    <li className="flex min-h-11 flex-wrap items-start gap-2 py-3">
      <span className="flex h-5 w-4 shrink-0 items-center">
        <UserCheck aria-hidden className="size-4 text-fg-muted" />
      </span>
      <p className="min-w-0 flex-1">
        <span className="font-semibold">
          <Defined def={GLOSSARY.adviserApproval} />
        </span>
        <span className="text-fg-muted">
          {dot}
          <span id={textId}>{text}</span>
        </span>
      </p>
      <RuleCourses
        ruleKey={ruleKey}
        listed={listed}
        describedBy={textId}
        context={context}
        className={UNDER_RULE}
      />
    </li>
  );
}

/** The courses the student listed under a rule, each with its status from the transcript and the plan, then "Add a course" to search the catalogue for another. */
function RuleCourses({
  ruleKey,
  listed,
  describedBy,
  context,
  className,
}: {
  ruleKey: string;
  listed: Claimed[];
  /** The rule's text, so each button names the rule it acts on. */
  describedBy?: string;
  context: Context;
  className?: string;
}) {
  const setAssigned = useProfileStore((state) => state.setAssigned);
  const setMarked = useProfileStore((state) => state.setMarked);
  const records = useProfileStore((state) => state.records);
  const [adding, setAdding] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const searchId = useId();
  const codes = listed.map(({ code }) => code);

  function save(next: string[]) {
    context.keepPane?.();
    setAssigned(ruleKey, next);
  }

  function close() {
    setAdding(false);
    toggle.current?.focus();
  }

  const undo = (label: string, run: () => void) => (
    <Button
      variant="secondary"
      aria-label={label}
      aria-describedby={describedBy}
      onClick={(event) => {
        context.keepPane?.();
        focusInPlace(event.currentTarget);
        run();
      }}
      className="max-lg:h-11"
    >
      {COPY.undo}
    </Button>
  );

  // "Mark as" only for a course with no record and no plan, and Undo only for what it wrote.
  function mark(code: string) {
    const own = records.filter((r) => r.code === code);
    const [only] = own;
    const plannedIn = context.planned.get(code);
    if (own.length === 1 && only && isMarked(only)) {
      const as = only.status === "completed" ? "taken" : "taking now";
      return undo(`${COPY.undo} marking ${code} as ${as}`, () =>
        setMarked(code, only.term, only.status, false),
      );
    }
    if (
      own.length === 0 &&
      plannedIn &&
      context.facts.get(code)?.status === "planned"
    ) {
      return undo(
        `${COPY.undo} planning ${code} for ${termLabel(plannedIn)}`,
        () => removeWithUndo(plannedIn, code),
      );
    }
    if (own.length > 0 || context.facts.has(code)) return null;
    return (
      <MarkAs
        course={context.catalogue.get(code) ?? stub(code)}
        describedBy={describedBy}
        keepPane={context.keepPane}
      />
    );
  }

  return (
    <div className={className}>
      {listed.length > 0 && (
        <>
          <p className="text-fg-muted">
            <Defined def={GLOSSARY.listedCourses} />
          </p>
          <ul aria-label={COPY.listedCourses}>
            {listed.map((claimed) => (
              <CountedRow
                key={claimed.code}
                claimed={claimed}
                context={context}
                mark={mark(claimed.code)}
                action={
                  <Button
                    variant="secondary"
                    aria-label={`Remove ${claimed.code}`}
                    aria-describedby={describedBy}
                    onClick={() => {
                      save(codes.filter((code) => code !== claimed.code));
                      toggle.current?.focus();
                    }}
                    className="max-lg:h-11"
                  >
                    Remove
                  </Button>
                }
              />
            ))}
          </ul>
        </>
      )}
      <Button
        ref={toggle}
        variant="ghost"
        aria-expanded={adding}
        aria-controls={searchId}
        aria-describedby={describedBy}
        onClick={() => (adding ? close() : setAdding(true))}
        className="-ml-2 px-2 max-lg:h-11"
      >
        <Plus aria-hidden />
        {COPY.addCourse}
      </Button>
      <div
        id={searchId}
        hidden={!adding}
        className="mt-2 max-w-md max-lg:max-w-none"
      >
        {adding && (
          <RulePicker
            codes={codes}
            onPick={(code) => save([...codes, code])}
            onClose={close}
            context={context}
          />
        )}
      </div>
    </div>
  );
}

/** One menu of terms for a listed course: taken in a past term, taking now, or planned for a start ahead. */
function MarkAs({
  course,
  describedBy,
  keepPane,
}: {
  course: CourseSummary;
  describedBy?: string;
  keepPane?: () => void;
}) {
  const setMarked = useProfileStore((state) => state.setMarked);
  const start = useProfileStore((state) => state.startTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const { choices, ready } = useStarts(course);
  const trigger = useRef<HTMLButtonElement>(null);
  const { code } = course;
  const now = currentTerm();
  const past = pastTermOptions(start);

  function pick(write: () => void) {
    keepPane?.();
    focusInPlace(trigger.current);
    write();
  }

  return (
    <Menu
      align="end"
      trigger={
        <Button
          ref={trigger}
          variant="secondary"
          aria-label={`${COPY.markAs} ${code}`}
          aria-describedby={describedBy}
          className="max-lg:h-11"
        >
          {COPY.markAs}
          <ChevronDown aria-hidden className="text-fg-muted" />
        </Button>
      }
    >
      {past.length > 0 && <MenuLabel>Taken in</MenuLabel>}
      {past.map((term) => (
        <MenuItem
          key={termKey(term)}
          onSelect={() => pick(() => setMarked(code, term, "completed", true))}
        >
          <span className="sr-only">Taken in </span>
          {termLabel(term)}
        </MenuItem>
      ))}
      <MenuLabel>Taking now</MenuLabel>
      <MenuItem
        onSelect={() => pick(() => setMarked(code, now, "in-progress", true))}
      >
        <span className="sr-only">Taking now </span>
        {termLabel(now)}
      </MenuItem>
      {choices.length > 0 && <MenuLabel>Plan for</MenuLabel>}
      {choices.map((choice) => (
        <TermItem
          key={termKey(choice.term)}
          course={course}
          choice={choice}
          planned={undefined}
          limit={ready ? creditLimit : null}
          never={false}
          prefix="Plan for"
          onAdd={(term) => pick(() => addWithUndo(term, code))}
        />
      ))}
    </Menu>
  );
}

/** The catalogue search under a rule's list, focused when it opens. A course already listed cannot be picked again. */
function RulePicker({
  codes,
  onPick,
  onClose,
  context: { catalogue, snapshot },
}: {
  codes: string[];
  onPick: (code: string) => void;
  onClose: () => void;
  context: Context;
}) {
  const index = useMemo(() => indexCourses(catalogue.values()), [catalogue]);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    wrap.current?.querySelector("input")?.focus();
  }, []);

  const stateOf = (course: CourseSummary): PickState => {
    const { status } = courseStatus(course, snapshot);
    const listed = codes.includes(course.code);
    return {
      status,
      disabled: listed,
      reason: "is already in your list",
      note: listed
        ? "Listed"
        : status === "available" || status === "locked"
          ? ""
          : STATUS[status].label,
    };
  };

  return (
    <div ref={wrap}>
      <CourseSearch
        label={COPY.addCourse}
        placeholder="Search all courses, like COMP 251"
        index={index}
        stateOf={stateOf}
        onPick={(course) => onPick(course.code)}
        onEscape={onClose}
      />
    </div>
  );
}

/** The second program's pane: its bar, then each of its groups the way a program group's pane shows it. */
function MinorPane({
  minor,
  view,
  withPlan,
  snapshot,
  context,
}: {
  minor: Program;
  view: NextView;
  withPlan: ProgramProgress | null;
  snapshot: Snapshot;
  context: Context;
}) {
  const groups = view.progress?.groups ?? [];
  const title = COPY.secondTitle(minor);
  const cut = title.lastIndexOf(" ") + 1;
  const pair = context.pair ?? "minor";
  const [first, second] = COPY.pair[pair].nouns;
  return (
    <Card
      className={BAND_WRAPS}
      title={
        <>
          {/* Only the last word stays with the info icon, so a long name wraps on a phone. */}
          {title.slice(0, cut)}
          <Defined def={{ label: title, tip: PAIR_TIPS[pair] }}>
            {title.slice(cut)}
          </Defined>
        </>
      }
      meta={
        <span className="max-md:flex max-md:flex-col max-md:gap-1">
          {minor.generated && (
            <span>
              <GeneratedNote hasChecks={hasChecks(minor)} />
              <span className="max-md:hidden">{dot}</span>
            </span>
          )}
          <span>
            {COPY.fraction(
              view.progress?.creditsDone ?? 0,
              view.progress?.credits ?? minor.credits,
            )}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-8">
        {withPlan && (
          <Progress
            {...programSplit(withPlan, snapshot)}
            total={withPlan.credits}
            courses={splitCourses(withPlan.groups, snapshot)}
          />
        )}
        {groups.map((group, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
          <section key={index} className="flex flex-col gap-4">
            <div className="flex items-center gap-4 max-md:flex-col max-md:items-start max-md:gap-1">
              <h3 className="flex items-center gap-2 text-base">
                {group.satisfied && <StatusIcon status="completed" />}
                {sentence(group.title)}
              </h3>
              <p className="ml-auto shrink-0 text-fg-muted tabular-nums max-md:ml-0">
                <GroupMeta
                  group={group}
                  split={withPlan?.groups[index]}
                  snapshot={snapshot}
                />
              </p>
            </div>
            <GroupBody
              group={group}
              index={index}
              program={minor}
              view={view}
              context={context}
              heading="h4"
            />
          </section>
        ))}
        {context.programOnly && context.programOnly.size > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-base">Counts for your {first} only</h3>
            <p className="text-fg-muted">
              This {second} shares{" "}
              {context.cap
                ? `at most ${COPY.credits(context.cap)}`
                : "no credits"}{" "}
              with your {first}, so these count for{" "}
              {pair === "extra" ? "one of them instead" : `your ${first} alone`}
              .
            </p>
            <ul className="-mx-5 border-line border-t px-5">
              {[...context.programOnly].sort().map((code) => (
                <CountedRow
                  key={code}
                  claimed={{
                    code,
                    credits: context.catalogue.get(code)?.credits ?? 0,
                  }}
                  context={{
                    ...context,
                    both: undefined,
                    programOnly: undefined,
                  }}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}

/** Done, current and planned courses no requirement takes. They still count toward the degree as electives. */
function NotCounted({
  courses: unclaimed,
  context,
  reasonFor,
}: {
  courses: Claimed[];
  context: Context;
  reasonFor: (code: string) => string | undefined;
}) {
  const credits = unclaimed.reduce((sum, claimed) => sum + claimed.credits, 0);
  return (
    <Card
      className={BAND_WRAPS}
      title={GLOSSARY.notCounted.label}
      meta={`${courseCount(unclaimed.length)}, ${COPY.credits(credits)}`}
    >
      <p className="text-fg-muted">{GLOSSARY.notCounted.tip}</p>
      <ul className="-mx-5 mt-4 border-line border-t px-5">
        {[...unclaimed].sort(byCode).map((claimed) => (
          <CountedRow
            key={claimed.code}
            claimed={claimed}
            context={context}
            reason={reasonFor(claimed.code)}
          />
        ))}
      </ul>
    </Card>
  );
}

/** Courses open in the term that the program does not ask for, as a pane. */
function OtherPane({
  entries,
  context,
}: {
  entries: Entry[];
  context: Context;
}) {
  const when = termLabel(context.term);
  return (
    <Card
      className={BAND_WRAPS}
      title={`Other courses you can take in ${when}`}
      meta={courseCount(entries.length)}
    >
      <div className="flex flex-col gap-6">
        <p className="text-fg-muted">
          {entries.length === 0
            ? `Nothing else is open to you in ${when}.`
            : `Courses open to you in ${when} that your program does not ask for. They count toward your degree as electives.`}
        </p>
        <Block
          status="available"
          title={`Can take in ${when}`}
          count={entries.length}
          heading="h3"
        >
          <Rows entries={entries} context={context} limit={OTHER_LIMIT} />
        </Block>
      </div>
    </Card>
  );
}

/** Other courses behind a click, for a student with no program yet. */
function OtherCourses({
  entries,
  context,
}: {
  entries: Entry[];
  context: Context;
}) {
  const term = termLabel(context.term);
  return (
    <Disclosure
      as="h2"
      summary={`Other courses you can take in ${term}`}
      meta={courseCount(entries.length)}
    >
      {entries.length === 0 ? (
        <p className="text-fg-muted">Nothing else is open to you in {term}.</p>
      ) : (
        <Rows entries={entries} context={context} limit={OTHER_LIMIT} />
      )}
    </Disclosure>
  );
}

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

function PageSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <div aria-hidden>
        <div className={cn(bone, "h-11 w-[400px] max-md:max-w-full")} />
        <div className={cn(bone, "mt-2 h-5 w-[480px] max-md:max-w-full")} />
        <div className={cn(bone, "mt-6 h-9 w-56")} />
        <div className="mt-6 grid grid-cols-[15rem_minmax(0,1fr)] gap-6 max-lg:block">
          <div className="flex flex-col gap-1">
            {Array.from({ length: 6 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={cn(bone, "h-14")} />
            ))}
          </div>
          <div className="max-lg:hidden">
            <div className={cn(bone, "h-7 w-64")} />
            <div className="mt-4">
              {Array.from({ length: 6 }, (_, row) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
                <div key={row} className="flex h-11 items-center gap-4">
                  <div className={cn(bone, "h-5 w-24")} />
                  <div className={cn(bone, "h-5 flex-1")} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
