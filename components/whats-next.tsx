"use client";

import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useId, useMemo, useRef } from "react";
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
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { ProgramBars } from "@/components/program-bars";
import {
  type Status,
  StatusBadge,
  StatusBar,
  StatusIcon,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { CARD, Card } from "@/components/ui/card";
import { Disclosure, ShowMore } from "@/components/ui/disclosure";
import { Term as Defined } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import {
  type Entry,
  type Item,
  type NextView,
  nextView,
  termSnapshot,
} from "@/lib/engine/next-view";
import { termLoad } from "@/lib/engine/plan";
import {
  type Claimed,
  type CreditSplit,
  creditSplit,
  type GroupProgress,
  minorOverlap,
  type ProgramProgress,
  programSplit,
  programStanding,
  STANDING,
  splitCourses,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { sentence } from "@/lib/format";
import { type Definition, GLOSSARY, shareDefinition } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  planTermOptions,
  termLabel,
} from "@/lib/profile/term-options";
import {
  type CourseRecord,
  isDone,
  type Plan,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
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
  term: Term;
  /** Course code to the term the plan starts it in. */
  planned: ReadonlyMap<string, Term>;
  facts: ReadonlyMap<string, Fact>;
  /** Courses the program lists or counts, so the minor's rows for them say they count for both. */
  both?: ReadonlySet<string>;
  /** The program's courses past the minor's overlap cap, which count for the program only. */
  programOnly?: ReadonlySet<string>;
  /** The minor's overlap cap, for the tooltips. */
  cap?: number;
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
  const minorId = useProfileStore((state) => state.minorId);
  const catalogue = useCatalogue();
  const program = useProgram(programId);
  const minor = useProgram(minorId);
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
    minor === undefined
  ) {
    return <PageSkeleton />;
  }
  return (
    <Page
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
      minor={minor}
    />
  );
}

function Page({
  snapshot,
  catalogue,
  program,
  minor,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  minor: Program | null;
}) {
  const entry = useProfileStore((state) => state.entry);
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const paneId = useId();
  const panes = useRef<HTMLDivElement>(null);
  const asked = useSearchParams().get("req");
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
  const view = useMemo(
    () => nextView(catalogue, judged, term, program, entry),
    [catalogue, judged, term, program, entry],
  );
  const overlap = useMemo(
    () =>
      minor &&
      minorOverlap(minor, program, judged, catalogue, entry, "counting"),
    [minor, program, judged, catalogue, entry],
  );
  const overlapWithPlan = useMemo(
    () =>
      minor && minorOverlap(minor, program, snapshot, catalogue, entry, "plan"),
    [minor, program, snapshot, catalogue, entry],
  );
  const minorView = useMemo(
    () =>
      minor &&
      nextView(catalogue, judged, term, minor, entry, overlap?.programOnly),
    [catalogue, judged, term, minor, entry, overlap],
  );
  // Not counted and the bars read the plan too, so a planned course shows before the student takes it.
  const withPlan = useMemo(
    () =>
      program
        ? programStanding(program, snapshot, catalogue, entry, "plan")
        : null,
    [program, snapshot, catalogue, entry],
  );
  const minorWithPlan = useMemo(
    () =>
      minor
        ? programStanding(
            minor,
            snapshot,
            catalogue,
            entry,
            "plan",
            overlapWithPlan?.programOnly,
          )
        : null,
    [minor, snapshot, catalogue, entry, overlapWithPlan],
  );
  const unclaimed = withPlan?.unclaimed ?? [];
  const context: Context = { catalogue, term, planned, facts };

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
        <div className="mt-6">
          <OtherCourses entries={view.other} context={context} />
        </div>
      </>
    );
  }

  const { creditsDone, credits, groups } = view.progress;
  const keys = groupKeys(groups);
  const when = termLabel(term);
  const requirements: Pane[] = groups.map((group, index) => {
    const split = withPlan?.groups[index];
    const counts = countsCredits(group);
    return {
      key: keys[index] ?? String(index),
      label: sentence(group.title),
      done: group.satisfied,
      side: group.credited
        ? "Credited from CEGEP"
        : counts
          ? `${Math.min(group.creditsDone, group.credits)} of ${group.credits}`
          : checksText(group.unparsed),
      split:
        !group.satisfied && counts && split
          ? { ...creditSplit(split, snapshot), total: group.credits }
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
          context={context}
        />
      ),
    };
  });
  if (minor && minorView?.progress) {
    const { progress } = minorView;
    requirements.push({
      key: "minor",
      label: COPY.minorTitle(minor.name),
      done: progress.satisfied,
      side: `${progress.creditsDone} of ${progress.credits}`,
      split:
        !progress.satisfied && minorWithPlan
          ? {
              ...programSplit(minorWithPlan, snapshot),
              total: minorWithPlan.credits,
            }
          : undefined,
      checks: progress.groups.reduce((sum, group) => sum + group.unparsed, 0),
      body: (
        <MinorPane
          minor={minor}
          view={minorView}
          withPlan={minorWithPlan}
          snapshot={snapshot}
          context={{
            ...context,
            // Once the cap is used, a course still to take would count for the program only.
            both:
              overlap && overlap.left <= 0
                ? overlap.shared
                : without(programCodes(view), overlap?.programOnly),
            programOnly: overlap?.programOnly,
            cap: overlap?.cap,
          }}
        />
      ),
    });
  }
  const extras: Pane[] = [
    ...(unclaimed.length > 0
      ? [
          {
            key: "not-counted",
            label: "Not counted",
            side: courseCount(unclaimed.length),
            body: <NotCounted courses={unclaimed} context={context} />,
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
  const pane =
    all.find((p) => p.key === asked) ??
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

  const minorBar =
    minor && minorView?.progress && minorWithPlan
      ? {
          label: COPY.minorTitle(minor.name),
          done: minorView.progress.creditsDone,
          split: programSplit(minorWithPlan, snapshot),
          total: minorView.progress.credits,
          courses: splitCourses(minorWithPlan.groups, snapshot),
        }
      : null;

  return (
    <>
      <h1>{program.name}</h1>
      <p className="mt-2 text-fg-muted">
        {minorBar ? (
          "Major and minor credits"
        ) : (
          <>
            <span className="tabular-nums">
              {creditsDone} of {credits}
            </span>{" "}
            program credits
          </>
        )}{" "}
        <Defined def={GLOSSARY.earnedOrInProgress} />
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
            program={{
              label: "Major",
              done: creditsDone,
              split: programSplit(withPlan, snapshot),
              total: credits,
              courses: splitCourses(withPlan.groups, snapshot),
            }}
            minor={minorBar}
          />
        </div>
      )}
      <div className="mt-6 flex items-center justify-between gap-4">
        <p>
          What you can take in{" "}
          <span className="font-semibold">{termLabel(term)}</span>, your next
          term ·{" "}
          <Link href="/plan" className="link">
            Plan later terms
          </Link>{" "}
          · Sections and times in <VsbLink />
        </p>
        <TermLoad
          credits={termLoad(plan, catalogue, term)}
          limit={creditLimit}
        />
      </div>

      <div
        ref={panes}
        className="mt-6 grid scroll-mt-6 grid-cols-[15rem_minmax(0,1fr)] items-start gap-6"
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
            <div
              role="tabpanel"
              id={paneId}
              aria-labelledby={`${paneId}-${pane.key}`}
            >
              {pane.body}
            </div>
          </>
        )}
      </div>
    </>
  );
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** One URL key per group from its title, numbered when two groups share one. */
function groupKeys(groups: GroupProgress[]): string[] {
  const seen = new Set<string>();
  return groups.map((group, index) => {
    const base = slug(group.title);
    const key = seen.has(base) ? `${base}-${index + 1}` : base;
    seen.add(key);
    return key;
  });
}

const countsCredits = (group: GroupProgress) =>
  group.kind === "required" || group.unparsed < group.rules.length;

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
          {pane.checks ? (
            <span className="flex h-5 items-center">
              <TriangleAlert aria-hidden className="size-3.5 text-warn" />
              <span className="sr-only">, {checksText(pane.checks)}</span>
            </span>
          ) : null}
        </span>
        {pane.split ? (
          <span className="flex items-center gap-3 font-normal">
            <span aria-hidden className="min-w-0 flex-1">
              <StatusBar {...pane.split} />
            </span>
            <span className="shrink-0 text-fg-muted tabular-nums">
              {pane.side}
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
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className={cn(
        CARD,
        "sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto px-3 py-2",
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

const DONE_ORDER = ["completed", "transfer", "exemption"];

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
  const best = new Map<string, CourseRecord>();
  for (const record of records) {
    const before = best.get(record.code);
    if (
      isDone(record.status) &&
      (!before ||
        DONE_ORDER.indexOf(record.status) < DONE_ORDER.indexOf(before.status))
    ) {
      best.set(record.code, record);
    }
  }
  for (const code of snapshot.done) {
    const record = best.get(code);
    facts.set(code, {
      status: snapshot.covered.has(code)
        ? "covered"
        : (record?.status ?? "completed"),
      term: record?.term ?? null,
    });
  }
  return facts;
}

const flatten = (items: Item[]) =>
  items.flatMap((item) => ("oneOf" in item ? item.oneOf : [item]));

const without = (codes: ReadonlySet<string>, drop?: ReadonlySet<string>) =>
  drop ? new Set([...codes].filter((code) => !drop.has(code))) : codes;

/** The share label on a minor's row: counts for both, or for the program only past the minor's cap. */
function shareFor(
  code: string,
  { both, programOnly, cap }: Context,
): Definition | undefined {
  if (programOnly?.has(code)) return shareDefinition(true, cap);
  if (both?.has(code)) return shareDefinition(false, cap);
}

/** Every course the program still lists or already counts, so a minor row for one of them counts for both. */
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

/** What the plan holds in the term against the credit limit, with a warn icon once it goes over. */
function TermLoad({ credits, limit }: { credits: number; limit: number }) {
  const over = credits > limit;
  return (
    <p
      className={cn(
        "flex items-center gap-2 tabular-nums",
        over ? "text-warn" : "text-fg-muted",
      )}
    >
      {over && <TriangleAlert aria-hidden className="size-4" />}
      {COPY.termLoad(credits, limit)}
    </p>
  );
}

const fraction = (group: GroupProgress) =>
  COPY.fraction(Math.min(group.creditsDone, group.credits), group.credits);

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
      {counts && fraction(group)}
      {counts && split && snapshot && (
        <StatusBar
          {...creditSplit(split, snapshot)}
          total={group.credits}
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
  return <StatusBar {...split} legend courses={courses} className="flex-1" />;
}

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
    <Card title={sentence(group.title)} meta={<GroupMeta group={group} />}>
      <div className="flex flex-col gap-6">
        {!group.credited && countsCredits(group) && split && (
          <Progress
            {...creditSplit(split, snapshot)}
            total={group.credits}
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
      <RequiredBlocks
        group={group}
        view={view}
        context={context}
        heading={heading}
      />
    );
  }
  const open = view.complementary.find((g) => g.index === index);
  return (
    <>
      {group.replaces && (
        <p className="text-fg-muted">{COPY.replaces(group.replaces)}</p>
      )}
      {open?.buckets.map((bucket) => (
        <Bucket
          key={bucket.title}
          title={bucket.title}
          progress={bucket.progress}
          entries={bucket.entries}
          context={context}
          heading={heading}
        />
      ))}
      {open && open.checks.length > 0 && (
        <ul>
          {open.checks.map((text, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share the same text and the list never reorders
            <CheckRow key={i} text={text} source={program.source} />
          ))}
        </ul>
      )}
      {!open &&
        !group.satisfied &&
        definition?.kind === "complementary" &&
        definition.rules.map((rule, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share a title and the list never reorders
          <p key={i} className="text-fg-muted">
            {rule.title}
          </p>
        ))}
      <Counted courses={group.courses} context={context} heading={heading} />
    </>
  );
}

/** Can take, planned and not open in the term, then the courses it counts. */
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
        status="available"
        title={`Can take in ${when}`}
        count={open.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={open} context={context} />
        </ul>
      </Block>
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
        status="locked"
        title={`Not open in ${when}`}
        count={blocked.length}
        heading={heading}
      >
        <ul>
          <ItemRows items={blocked} context={context} />
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
}: {
  items: Item[];
  context: Context;
  plannedBlock?: boolean;
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
      />
    ),
  );
}

/** A course still to take: open with Add, planned with Remove in its own term, or not open with why. Under the Planned heading the term alone says it. */
function Row({
  entry: { course, uncertain, reason },
  context,
  plannedBlock = false,
}: {
  entry: Entry;
  context: Context;
  plannedBlock?: boolean;
}) {
  const { term, planned } = context;
  const plannedIn = planned.get(course.code);
  const here = plannedIn !== undefined && termKey(plannedIn) === termKey(term);
  const when = termLabel(term);
  const label = (add: boolean) =>
    `${add ? "Add" : "Remove"} ${course.code} ${add ? "to" : "from"} ${when}`;

  function toggle() {
    if (here) removeWithUndo(term, course.code);
    else addWithUndo(term, course.code);
    // The row moves to another block, so focus follows it there.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[aria-label="${CSS.escape(label(here))}"]`)
        ?.focus(),
    );
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
      action={
        here || (!plannedIn && !reason) ? (
          <Button
            variant="secondary"
            aria-label={label(!here)}
            onClick={toggle}
          >
            {here ? "Remove" : "Add"}
          </Button>
        ) : null
      }
    />
  );
}

/** A course row of a pane: code and title, "Counts for both" when it does, a note column that keeps its width so notes line up at 1024 too, credits, and the action on hover. */
function PaneRow({
  course,
  title,
  uncertain = false,
  share,
  note,
  action,
}: {
  course: CourseSummary;
  /** Stands in for the course link, for a row with no course behind it. */
  title?: ReactNode;
  uncertain?: boolean;
  /** On a minor's row: counts for both, or for the program only. */
  share?: Definition;
  note: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className={ROW}>
      <span className={ROW_TITLE}>
        {title ?? (
          <Link
            href={`/courses/${courseSlug(course.code)}`}
            prefetch={false}
            className={ROW_LINK}
          >
            <span className="w-24 shrink-0 font-semibold">
              <CourseCode code={course.code} />
            </span>
            <span className="min-w-0 truncate" title={course.title}>
              {course.title}
            </span>
          </Link>
        )}
        {uncertain && <UncertainFlag />}
        {share && (
          <span className="hidden shrink-0 text-fg-muted @3xl:inline">
            <Defined def={share} />
          </span>
        )}
      </span>
      <span className="flex w-50 shrink-0 flex-wrap items-start gap-x-2 gap-y-1 text-fg-muted @3xl:w-64">
        {note}
        {/* Too wide beside a title in a narrow row, so it moves under the note there. */}
        {share && (
          <span className="@3xl:hidden">
            <Defined def={share} />
          </span>
        )}
      </span>
      <span className="w-22 shrink-0 whitespace-nowrap text-right text-fg-muted tabular-nums">
        <CreditsLabel course={course} />
      </span>
      <span className="-my-2 flex w-20 shrink-0 justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
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

/** A course a requirement counts, or one no requirement counts, with the student's status and term for it. */
function CountedRow({
  claimed: { code, credits },
  context,
}: {
  claimed: Claimed;
  context: Context;
}) {
  const { catalogue, facts } = context;
  if (code === STANDING) {
    return (
      <PaneRow
        course={{ ...stub(code), credits }}
        title={<span className="font-semibold">Advanced standing</span>}
        note="Credit from before McGill"
      />
    );
  }
  const { status, term } = facts.get(code) ?? {
    status: "completed",
    term: null,
  };
  const course = catalogue.get(code) ?? stub(code);
  // An exemption or a DEC equivalent meets the requirement, but its credits go to the replace group.
  const toReplace =
    (status === "exemption" || status === "covered") && course.credits
      ? `${COPY.credits(course.credits)} to replace`
      : null;
  return (
    <PaneRow
      course={{ ...course, credits }}
      share={shareFor(code, context)}
      note={
        <>
          <StatusBadge status={status} />
          {term && <span>{termLabel(term)}</span>}
          {toReplace && <span>{toReplace}</span>}
        </>
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

/** A rule the crawler could not read. It shows the catalogue text and links to the program, and never counts as done. */
function CheckRow({ text, source }: { text: string; source: string }) {
  return (
    <li className="flex min-h-11 items-start gap-2 py-3">
      <span className="flex h-5 w-4 shrink-0 items-center">
        <TriangleAlert aria-hidden className="size-4 text-warn" />
      </span>
      <p className="min-w-0">
        <span className="font-semibold">
          <Defined def={GLOSSARY.checkRequirement} />
        </span>
        <span className="text-fg-muted">
          {dot}
          {text}
          {dot}
        </span>
        <CatalogueLink href={coursesTab(source)} />
      </p>
    </li>
  );
}

/** The minor's pane: its bar, then each of its groups the way a program group's pane shows it. */
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
  return (
    <Card
      title={
        <Defined
          def={{ label: COPY.minorTitle(minor.name), tip: GLOSSARY.minor.tip }}
        />
      }
      meta={
        <>
          {minor.generated && (
            <>
              <GeneratedNote hasChecks={hasChecks(minor)} />
              {dot}
            </>
          )}
          {COPY.fraction(
            view.progress?.creditsDone ?? 0,
            view.progress?.credits ?? minor.credits,
          )}
        </>
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
            <div className="flex items-center gap-4">
              <h3 className="flex items-center gap-2 text-base">
                {group.satisfied && <StatusIcon status="completed" />}
                {sentence(group.title)}
              </h3>
              <p className="ml-auto shrink-0 text-fg-muted tabular-nums">
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
            <h3 className="text-base">Counts for your program only</h3>
            <p className="text-fg-muted">
              This minor shares{" "}
              {context.cap
                ? `at most ${COPY.credits(context.cap)}`
                : "no credits"}{" "}
              with your program, so these count for your program alone.
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
}: {
  courses: Claimed[];
  context: Context;
}) {
  const credits = unclaimed.reduce((sum, claimed) => sum + claimed.credits, 0);
  return (
    <Card
      title={GLOSSARY.notCounted.label}
      meta={`${courseCount(unclaimed.length)}, ${COPY.credits(credits)}`}
    >
      <p className="text-fg-muted">{GLOSSARY.notCounted.tip}</p>
      <ul className="-mx-5 mt-4 border-line border-t px-5">
        {[...unclaimed].sort(byCode).map((claimed) => (
          <CountedRow key={claimed.code} claimed={claimed} context={context} />
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
        <div className={cn(bone, "h-11 w-[400px]")} />
        <div className={cn(bone, "mt-2 h-5 w-[480px]")} />
        <div className={cn(bone, "mt-6 h-9 w-56")} />
        <div className="mt-6 grid grid-cols-[15rem_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-1">
            {Array.from({ length: 6 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={cn(bone, "h-14")} />
            ))}
          </div>
          <div>
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
