"use client";

import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useMemo, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { CourseRow, seasonsOffered } from "@/components/course-row";
import { CatalogueLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { NoProfile } from "@/components/no-profile";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import {
  type Status,
  StatusBadge,
  StatusBar,
  StatusIcon,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { Disclosure, ShowMore } from "@/components/ui/disclosure";
import { Section } from "@/components/ui/section";
import { ViewTabs } from "@/components/ui/tabs";
import { Term as Defined } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { exemptionsToReplace } from "@/lib/engine/credits";
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
  creditSplit,
  type GroupProgress,
  type ProgramProgress,
  programSplit,
  programStanding,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { sentence } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
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

const TERMS_SHOWN = 2;
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
}

export function WhatsNext() {
  const snapshot = useSnapshot();
  if (snapshot === null) {
    return (
      <NoProfile
        title="See what you can take next"
        lede="Import your unofficial transcript to see the courses you can take next term and what you still need to graduate."
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
  const panelId = useId();
  const terms = useMemo(() => planTermOptions([]).slice(0, TERMS_SHOWN), []);
  const [picked, setPicked] = useState<string>();
  const term =
    terms.find((t) => String(termKey(t)) === picked) ??
    terms[0] ??
    currentTerm();

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
  const minorView = useMemo(
    () => minor && nextView(catalogue, judged, term, minor, entry),
    [catalogue, judged, term, minor, entry],
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
      minor ? programStanding(minor, snapshot, catalogue, entry, "plan") : null,
    [minor, snapshot, catalogue, entry],
  );
  const unclaimed = withPlan?.unclaimed ?? [];
  const exemptions = useMemo(
    () => exemptionsToReplace(records, catalogue),
    [records, catalogue],
  );
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
  const met = groups.filter((group) => group.satisfied);
  const required = groups.filter(
    (group) => group.kind === "required" && !group.credited,
  );
  const requiredDone =
    required.length > 0 &&
    required.every((group) => group.remaining.length === 0);

  return (
    <>
      <h1>{program.name}</h1>
      <p className="mt-2 text-fg-muted">
        <span className="tabular-nums">
          {creditsDone} of {credits}
        </span>{" "}
        program credits <Defined def={GLOSSARY.earnedOrInProgress} />
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
          <StatusBar
            {...programSplit(withPlan, snapshot)}
            total={credits}
            legend
            className="w-80"
          />
        </div>
      )}
      <div className="mt-6 flex items-center justify-between gap-4">
        <ViewTabs
          label="Term"
          tabs={terms.map((t) => ({
            id: String(termKey(t)),
            label: termLabel(t),
          }))}
          value={String(termKey(term))}
          onChange={setPicked}
          panelId={panelId}
        />
        <TermLoad
          credits={termLoad(plan, catalogue, term)}
          limit={creditLimit}
        />
      </div>
      {exemptions.length > 0 && (
        <ul className="mt-4">
          {exemptions.map(({ code, credits }) => (
            <li key={code}>
              {code} was exempted without credit. Replace{" "}
              {credits === null
                ? "its credits"
                : `its ${COPY.credits(credits)}`}{" "}
              with another course.
            </li>
          ))}
        </ul>
      )}

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${panelId}-${termKey(term)}`}
        className="mt-6 [&>*+*]:mt-6"
      >
        {requiredDone && <p>Every required course is done or in progress.</p>}
        {groups.map((group, index) =>
          group.satisfied ? null : (
            <Section
              // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
              key={index}
              title={sentence(group.title)}
              meta={
                <GroupMeta
                  group={group}
                  split={withPlan?.groups[index]}
                  snapshot={snapshot}
                />
              }
            >
              <GroupBody
                group={group}
                index={index}
                program={program}
                view={view}
                context={context}
                label="h3"
              />
            </Section>
          ),
        )}
        {minor && minorView && (
          <MinorSection
            minor={minor}
            view={minorView}
            withPlan={minorWithPlan}
            snapshot={snapshot}
            context={{ ...context, both: programCodes(view) }}
          />
        )}
        {met.length > 0 && (
          <Section title="Completed requirements">
            <MetLines groups={met} context={context} />
          </Section>
        )}
        {unclaimed.length > 0 && (
          <NotCounted courses={unclaimed} context={context} />
        )}
        <OtherCourses entries={view.other} context={context} />
      </div>
    </>
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

/** Rules to check, then credits and their bar, unless every rule needs a check and nothing can count. `split` is the same group counted with the plan. */
function GroupMeta({
  group,
  split,
  snapshot,
}: {
  group: GroupProgress;
  split: GroupProgress | undefined;
  snapshot: Snapshot;
}) {
  const checks = group.unparsed;
  const counts = group.kind === "required" || checks < group.rules.length;
  return (
    <span className="inline-flex items-center gap-4">
      {checks > 0 && (
        <span className="inline-flex items-center gap-2">
          <TriangleAlert aria-hidden className="size-4 text-warn" />
          {checks === 1 ? "1 rule to check" : `${checks} rules to check`}
        </span>
      )}
      {counts && fraction(group)}
      {counts && split && (
        <StatusBar
          {...creditSplit(split, snapshot)}
          total={group.credits}
          className="w-20"
        />
      )}
    </span>
  );
}

/** A label above a list inside a section: a rule of a program group, or a group of the minor. */
function Label({
  as: Heading,
  title,
  meta,
}: {
  as: "h3" | "h4";
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-4">
      <Heading className={cn(Heading === "h4" && "font-normal text-fg-muted")}>
        {title}
      </Heading>
      {meta && <p className="ml-auto shrink-0 text-fg-muted">{meta}</p>}
    </div>
  );
}

/** What a group still needs: its rows, rules to check and the courses it already counts. */
function GroupBody({
  group,
  index,
  program,
  view,
  context,
  label,
}: {
  group: GroupProgress;
  index: number;
  program: Program;
  view: NextView;
  context: Context;
  label: "h3" | "h4";
}) {
  if (group.kind === "required") {
    return <RequiredBody group={group} view={view} context={context} />;
  }
  const open = view.complementary.find((g) => g.index === index);
  const definition = program.groups[index];
  return (
    <div>
      {open
        ? open.buckets.map((bucket) => (
            <Bucket
              key={bucket.title}
              title={open.titled ? bucket.title : null}
              progress={bucket.progress}
              entries={bucket.entries}
              context={context}
              label={label}
            />
          ))
        : definition?.kind === "complementary" &&
          definition.rules.map((rule, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share a title and the list never reorders
            <p key={i} className="text-fg-muted">
              {rule.title}
            </p>
          ))}
      {open && open.checks.length > 0 && (
        <ul className="mt-2 first:mt-0">
          {open.checks.map((text, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share the same text and the list never reorders
            <CheckRow key={i} text={text} source={program.source} />
          ))}
        </ul>
      )}
      <Counted courses={group.courses} context={context} />
    </div>
  );
}

/** Open rows, then planned rows, then the rows not open in the term with why. */
function RequiredBody({
  group,
  view,
  context,
}: {
  group: GroupProgress;
  view: NextView;
  context: Context;
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
  const first = [
    ...ready.filter((item) => !isPlanned(item)),
    ...[...ready, ...later].filter(isPlanned),
  ];
  const blocked = later.filter((item) => !isPlanned(item));
  return (
    <div>
      {first.length + blocked.length > 0 && (
        <ul>
          <ItemRows items={[...first, ...blocked]} context={context} />
        </ul>
      )}
      <Counted courses={group.courses} context={context} />
    </div>
  );
}

function ItemRows({ items, context }: { items: Item[]; context: Context }) {
  return items.map((item) =>
    "oneOf" in item ? (
      <li
        key={item.oneOf.map(({ course }) => course.code).join()}
        className="-mx-5 border-line border-t px-5 pt-3 first:border-t-0 first:pt-0"
      >
        <p className="pb-1 text-fg-muted">Take one of these</p>
        <ul>
          {item.oneOf.map((entry) => (
            <Row key={entry.course.code} entry={entry} context={context} />
          ))}
        </ul>
      </li>
    ) : (
      <Row key={item.course.code} entry={item} context={context} />
    ),
  );
}

/** A course still to take: open with Add, planned with Remove in its own term, or locked with the reason. */
function Row({
  entry: { course, uncertain, reason },
  context: { term, planned, both },
}: {
  entry: Entry;
  context: Context;
}) {
  const plannedIn = planned.get(course.code);
  const here = plannedIn !== undefined && termKey(plannedIn) === termKey(term);
  const status = plannedIn ? "planned" : reason ? "locked" : "available";
  const label = `${here ? "Remove" : "Add"} ${course.code} ${here ? "from" : "to"} ${termLabel(term)}`;
  return (
    <CourseRow
      course={course}
      status={status}
      showGlyph
      uncertain={uncertain}
      reason={plannedIn ? COPY.plannedFor(plannedIn) : reason}
      tip={
        status === "available" ? `Offered ${seasonsOffered(course)}` : undefined
      }
      meta={both?.has(course.code) && <Defined def={GLOSSARY.countsForBoth} />}
      action={
        here || status === "available" ? (
          <Button
            variant="secondary"
            aria-label={label}
            onClick={() =>
              here
                ? removeWithUndo(term, course.code)
                : addWithUndo(term, course.code)
            }
          >
            {here ? "Remove" : "Add"}
          </Button>
        ) : null
      }
    />
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
  context: { catalogue, facts, both },
}: {
  claimed: Claimed;
  context: Context;
}) {
  const { status, term } = facts.get(code) ?? {
    status: "completed",
    term: null,
  };
  return (
    <CourseRow
      course={{ ...(catalogue.get(code) ?? stub(code)), credits }}
      status={status}
      showGlyph
      meta={
        <>
          <StatusBadge status={status} />
          {term && <span>{termLabel(term)}</span>}
          {both?.has(code) && <Defined def={GLOSSARY.countsForBoth} />}
        </>
      }
      action={null}
    />
  );
}

/** The courses a group counts, one click away. */
function Counted({
  courses: counted,
  context,
}: {
  courses: Claimed[];
  context: Context;
}) {
  if (counted.length === 0) return null;
  return (
    <Disclosure summary={`${courseCount(counted.length)} counted`}>
      <ul>
        {[...counted].sort(byCode).map((claimed) => (
          <CountedRow key={claimed.code} claimed={claimed} context={context} />
        ))}
      </ul>
    </Disclosure>
  );
}

/** One rule's list: planned rows first, then at most five more until the student asks for the rest. */
function Bucket({
  title,
  progress,
  entries,
  context,
  label,
}: {
  title: string | null;
  progress: string | null;
  entries: Entry[];
  context: Context;
  label: "h3" | "h4";
}) {
  const isPlanned = (entry: Entry) => context.planned.has(entry.course.code);
  const ordered = [
    ...entries.filter(isPlanned),
    ...entries.filter((entry) => !isPlanned(entry)),
  ];
  return (
    <div className="mt-6 first:mt-0">
      {title && <Label as={label} title={title} meta={progress} />}
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

/** The minor under its own heading, built by the same engine as the program. */
function MinorSection({
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
  const met = groups.filter((group) => group.satisfied);
  return (
    <Section
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
          {withPlan && (
            <StatusBar
              {...programSplit(withPlan, snapshot)}
              total={withPlan.credits}
              className="ml-4 inline-flex w-20 align-middle"
            />
          )}
        </>
      }
    >
      <div>
        {groups.map((group, index) =>
          group.satisfied ? null : (
            // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
            <div key={index} className="mt-8 first:mt-0">
              <Label
                as="h3"
                title={sentence(group.title)}
                meta={
                  <GroupMeta
                    group={group}
                    split={withPlan?.groups[index]}
                    snapshot={snapshot}
                  />
                }
              />
              <GroupBody
                group={group}
                index={index}
                program={minor}
                view={view}
                context={context}
                label="h4"
              />
            </div>
          ),
        )}
        {met.length > 0 && (
          <div className="mt-8 first:mt-0">
            <MetLines groups={met} context={context} />
          </div>
        )}
      </div>
    </Section>
  );
}

/** One line per met group: its credits, and its courses one click away. A CEGEP-credited group says so instead. */
function MetLines({
  groups,
  context,
}: {
  groups: GroupProgress[];
  context: Context;
}) {
  return groups.map((group, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
    <MetLine key={i} group={group} context={context} />
  ));
}

function MetLine({
  group,
  context,
}: {
  group: GroupProgress;
  context: Context;
}) {
  const title = sentence(group.title);
  if (group.courses.length === 0) {
    return (
      <div className="-mx-5 flex min-h-11 items-center gap-2 border-line border-t pr-5 pl-11 first:border-t-0">
        <StatusIcon status="completed" />
        <h3>{title}</h3>
        <p className="ml-auto text-fg-muted">
          {group.credited
            ? "Credited from your Quebec CEGEP diploma"
            : fraction(group)}
        </p>
      </div>
    );
  }
  return (
    <Disclosure
      as="h3"
      summary={
        <span className="inline-flex items-center gap-2">
          <StatusIcon status="completed" />
          {title}
        </span>
      }
      meta={
        <>
          {fraction(group)}
          {dot}
          {courseCount(group.courses.length)} counted
        </>
      }
    >
      <ul>
        {[...group.courses].sort(byCode).map((claimed) => (
          <CountedRow key={claimed.code} claimed={claimed} context={context} />
        ))}
      </ul>
    </Disclosure>
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
    <Disclosure
      as="h2"
      summary={GLOSSARY.notCounted.label}
      def={GLOSSARY.notCounted}
      meta={`${courseCount(unclaimed.length)}, ${COPY.credits(credits)}`}
    >
      <ul>
        {[...unclaimed].sort(byCode).map((claimed) => (
          <CountedRow key={claimed.code} claimed={claimed} context={context} />
        ))}
      </ul>
    </Disclosure>
  );
}

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
        <div className={cn(bone, "mt-12 h-7 w-48")} />
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
  );
}
