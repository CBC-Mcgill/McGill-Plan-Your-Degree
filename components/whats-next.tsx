"use client";

import { cn } from "cn";
import { Check, ChevronDown, Compass, FileUp, Info } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { AddToPlan, PlannedLink } from "@/components/add-to-plan";
import { CourseRow, CourseRowSkeleton } from "@/components/course-row";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCatalogue } from "@/lib/catalogue/client";
import {
  degreeCredits,
  type Exemption,
  earnedCredits,
  exemptionsToReplace,
} from "@/lib/engine/credits";
import {
  type Bucket,
  type Entry,
  type Item,
  type NextView,
  nextView,
  type OpenGroup,
} from "@/lib/engine/next-view";
import type { ProgramProgress } from "@/lib/engine/progress";
import type { Snapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { getProgram } from "@/lib/programs";
import type { Program } from "@/lib/programs/types";

const TERMS_SHOWN = 4;
const BUCKET_LIMIT = 10;
const OTHER_LIMIT = 20;
/** Required later starts closed when it has more courses than this. */
const LATER_OPEN_LIMIT = 6;
const NO_COURSES: ReadonlySet<string> = new Set();

interface Context {
  term: Term;
  planned: ReadonlySet<string>;
}

/** Credits toward the whole degree, and exemptions that left credits to make up. */
interface Background {
  degree: { done: number; required: number; advancedStanding: number } | null;
  exemptions: Exemption[];
}

export function WhatsNext() {
  const snapshot = useSnapshot();
  if (snapshot === null) {
    return (
      <>
        <Header />
        <EmptyState />
      </>
    );
  }
  if (snapshot === undefined) {
    return (
      <>
        <Header />
        <PageSkeleton />
      </>
    );
  }
  return <WhatsNextReady snapshot={snapshot} />;
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1 className="text-4xl">What's next</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          The courses you can take next term, and what you still need to
          graduate.
        </p>
      </div>
      {children}
    </div>
  );
}

// Split out so a visitor without a profile does not download the catalogue.
function WhatsNextReady({ snapshot }: { snapshot: Snapshot }) {
  const programId = useProfileStore((state) => state.programId);
  const entry = useProfileStore((state) => state.entry);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const creditsRequired = useProfileStore((state) => state.creditsRequired);
  const records = useProfileStore((state) => state.records);
  const catalogue = useCatalogue();
  const options = useMemo(() => planTermOptions([]).slice(0, TERMS_SHOWN), []);
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    options.find((option) => termKey(option) === picked) ?? options[0];

  // Planned courses stay in the lists, so adding one shows "Planned" and the row does not vanish.
  const unplanned = useMemo(
    () => ({ ...snapshot, planned: NO_COURSES }),
    [snapshot],
  );
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const program = programId ? (getProgram(programId) ?? null) : null;
  const view = useMemo(
    () =>
      courses && selected
        ? nextView(courses, unplanned, selected, program, entry)
        : null,
    [unplanned, courses, selected, program, entry],
  );
  const background = useMemo((): Background => {
    const required = degreeCredits(creditsRequired, entry, program);
    return {
      degree:
        courses && required !== null
          ? {
              done: earnedCredits(snapshot, courses) + advancedStanding,
              required,
              advancedStanding,
            }
          : null,
      exemptions: courses ? exemptionsToReplace(records, courses) : [],
    };
  }, [
    courses,
    snapshot,
    creditsRequired,
    entry,
    program,
    advancedStanding,
    records,
  ]);

  return (
    <>
      <Header>
        {view && selected && (
          <label className="flex shrink-0 flex-col gap-1.5 font-semibold text-sm">
            Term
            <select
              value={termKey(selected)}
              onChange={(event) => setPicked(Number(event.target.value))}
              className="h-12 w-44 rounded-md border-2 border-border-strong bg-card px-3 font-normal text-base"
            >
              {options.map((option) => (
                <option key={termKey(option)} value={termKey(option)}>
                  {termLabel(option)}
                </option>
              ))}
            </select>
          </label>
        )}
      </Header>

      {catalogue.status === "error" ? (
        <p role="alert" className="mt-8">
          Could not load the course list. Reload the page to try again.
        </p>
      ) : view && selected ? (
        <Content
          view={view}
          program={program}
          background={background}
          context={{ term: selected, planned: snapshot.planned }}
          inProgress={snapshot.inProgress.size > 0}
        />
      ) : (
        <PageSkeleton />
      )}
    </>
  );
}

function Content({
  view,
  program,
  background,
  context,
  inProgress,
}: {
  view: NextView;
  program: Program | null;
  background: Background;
  context: Context;
  inProgress: boolean;
}) {
  const { term } = context;
  const { mustTake, later, complementary, other } = view;
  return (
    <div className="mt-8 flex flex-col gap-10">
      {program && view.progress ? (
        <ProgramCard
          program={program}
          progress={view.progress}
          background={background}
          inProgress={inProgress}
        />
      ) : (
        <p className="rounded-lg border-2 border-border bg-card px-6 py-4">
          <Link
            href="/profile"
            className="font-semibold underline underline-offset-2 hover:text-primary"
          >
            Pick your program
          </Link>{" "}
          to see which required courses you still need.
        </p>
      )}

      {program && (
        <Section
          id="must-take"
          title="Must take"
          count={mustTake.length}
          hint={`Required courses you can take in ${termLabel(term)}.`}
        >
          {mustTake.length > 0 ? (
            <Items items={mustTake} context={context} />
          ) : (
            <p className="rounded-lg border-2 border-border bg-card px-6 py-6 text-muted-foreground">
              {later.length > 0
                ? `No required course is open in ${termLabel(term)}. See what comes later below.`
                : "You have taken every required course. Nice work!"}
            </p>
          )}
        </Section>
      )}

      {later.length > 0 && (
        <section aria-labelledby="later">
          <details open={later.length <= LATER_OPEN_LIMIT} className="group">
            <summary className="flex cursor-pointer list-none items-baseline gap-3 rounded-md [&::-webkit-details-marker]:hidden">
              <h2 id="later" className="text-2xl">
                Required later
              </h2>
              <span className="font-semibold text-muted-foreground">
                {later.length}
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-semibold text-muted-foreground text-sm">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            <p className="mt-1 mb-3 text-muted-foreground">
              Required courses you cannot take in {termLabel(term)} yet, and
              why.
            </p>
            <Items items={later} context={context} />
          </details>
        </section>
      )}

      {complementary.length > 0 && (
        <Section
          id="complementary"
          title="Complementary options"
          hint={`Courses open in ${termLabel(term)} that count toward your complementary credits.`}
        >
          <div className="flex flex-col gap-6">
            {complementary.map((group) => (
              <GroupCard key={group.title} group={group} context={context} />
            ))}
          </div>
        </Section>
      )}

      <Section
        id="other"
        title="Other courses you can take"
        count={other.length}
        hint={`Open to you in ${termLabel(term)}, such as electives.`}
      >
        {other.length > 0 ? (
          <Items items={other.slice(0, OTHER_LIMIT)} context={context} />
        ) : (
          <p className="rounded-lg border-2 border-border bg-card px-6 py-6 text-muted-foreground">
            Nothing else is open to you in {termLabel(term)}.
          </p>
        )}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/courses?status=available&term=${term.season}`}>
              See all courses you can take
            </Link>
          </Button>
          {other.length > OTHER_LIMIT && (
            <p className="text-muted-foreground text-sm">
              Showing {OTHER_LIMIT} of {other.length.toLocaleString()}
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  count,
  hint,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline gap-3">
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        {count !== undefined && (
          <span className="font-semibold text-muted-foreground">
            {count.toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-1 mb-3 text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function ProgramCard({
  program,
  progress,
  background: { degree, exemptions },
  inProgress,
}: {
  program: Program;
  progress: ProgramProgress;
  background: Background;
  inProgress: boolean;
}) {
  const { creditsDone, credits } = progress;
  return (
    <section
      aria-labelledby="program"
      className="rounded-lg border-2 border-border bg-card p-6"
    >
      <div className="flex items-baseline justify-between gap-6">
        <h2 id="program" className="text-xl">
          {program.name}
        </h2>
        <p className="font-bold tabular-nums">
          {creditsDone} of {credits} credits
        </p>
      </div>
      <Progress
        value={creditsDone}
        max={credits}
        aria-label={`${program.name} progress`}
        aria-valuetext={`${creditsDone} of ${credits} credits`}
        className="mt-3 h-4 text-completed"
      />
      {inProgress && (
        <p className="mt-2 text-muted-foreground text-sm">
          Includes the courses you are taking now.
        </p>
      )}
      {degree && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Degree credits:</span>{" "}
          <span className="tabular-nums">
            {degree.done} of {degree.required}
          </span>
          {degree.advancedStanding > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ({degree.advancedStanding} are advanced standing)
            </span>
          )}
        </p>
      )}
      <ul className="mt-5 columns-2 gap-x-10">
        {progress.groups.map((group) => (
          <li
            key={group.title}
            className="flex break-inside-avoid items-center gap-2.5 pb-2.5 text-sm"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                group.satisfied
                  ? "bg-completed text-white"
                  : "border-2 border-border-strong",
              )}
            >
              {group.satisfied && (
                <Check className="size-3.5" strokeWidth={3} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {group.title}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {group.credited
                ? "Credited from CEGEP"
                : `${Math.min(group.creditsDone, group.credits)} of ${group.credits} credits`}
              {group.satisfied && <span className="sr-only">, done</span>}
            </span>
          </li>
        ))}
      </ul>
      {exemptions.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {exemptions.map(({ code, credits }) => (
            <li
              key={code}
              className="flex items-start gap-2.5 rounded-md border border-border bg-muted p-3 text-sm"
            >
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {code} was exempted without credit. Replace{" "}
                {credits === null
                  ? "its credits"
                  : `its ${credits} ${credits === 1 ? "credit" : "credits"}`}{" "}
                with another course.
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GroupCard({ group, context }: { group: OpenGroup; context: Context }) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-border bg-card">
      <div className="border-border border-b bg-muted/40 px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg">{group.title}</h3>
          <p className="font-semibold text-sm tabular-nums">
            {group.creditsDone} of {group.credits} credits
          </p>
        </div>
        <Progress
          value={group.creditsDone}
          max={group.credits}
          aria-label={`${group.title} progress`}
          aria-valuetext={`${group.creditsDone} of ${group.credits} credits`}
          className="mt-2 h-2 text-completed"
        />
      </div>
      {group.buckets.map((bucket) => (
        <BucketList
          key={bucket.title}
          bucket={bucket}
          showTitle={group.titled}
          context={context}
        />
      ))}
    </div>
  );
}

function BucketList({
  bucket,
  showTitle,
  context,
}: {
  bucket: Bucket;
  showTitle: boolean;
  context: Context;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? bucket.entries : bucket.entries.slice(0, BUCKET_LIMIT);
  const hidden = bucket.entries.length - shown.length;
  return (
    <div className="border-border border-b last:border-b-0">
      {showTitle && (
        <div className="flex items-baseline justify-between gap-4 px-4 pt-3 pb-1">
          <h4 className="font-bold">{bucket.title}</h4>
          {bucket.progress && (
            <p className="shrink-0 text-muted-foreground text-sm tabular-nums">
              {bucket.progress}
            </p>
          )}
        </div>
      )}
      <ul className="divide-y divide-border">
        {shown.map((entry) => (
          <EntryRow key={entry.course.code} entry={entry} context={context} />
        ))}
      </ul>
      {hidden > 0 && (
        <div className="px-4 py-3">
          <Button
            variant="secondary"
            className="h-9 px-3 text-sm"
            onClick={() => setAll(true)}
          >
            Show {hidden} more
          </Button>
        </div>
      )}
    </div>
  );
}

function Items({ items, context }: { items: Item[]; context: Context }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border-2 border-border bg-card">
      {items.map((item) =>
        "oneOf" in item ? (
          <li
            key={item.oneOf.map((entry) => entry.course.code).join()}
            className="border-l-4 border-l-in-progress bg-muted/30"
          >
            <p className="px-4 pt-3 pb-1 font-bold text-in-progress text-sm">
              One of
            </p>
            <ul className="divide-y divide-border">
              {item.oneOf.map((entry) => (
                <EntryRow
                  key={entry.course.code}
                  entry={entry}
                  context={context}
                />
              ))}
            </ul>
          </li>
        ) : (
          <EntryRow key={item.course.code} entry={item} context={context} />
        ),
      )}
    </ul>
  );
}

/** A course with a reason cannot be taken in the term, so it gets no add button. */
function EntryRow({
  entry: { course, uncertain, reason },
  context: { term, planned },
}: {
  entry: Entry;
  context: Context;
}) {
  return (
    <CourseRow
      course={course}
      note={
        (reason || uncertain) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {reason && (
              <span className="text-muted-foreground text-sm">{reason}</span>
            )}
            {uncertain && <StatusChip status="check-requirements" />}
          </span>
        )
      }
      action={
        reason ? (
          planned.has(course.code) ? (
            <PlannedLink code={course.code} />
          ) : null
        ) : (
          <AddToPlan course={course} term={term} />
        )
      }
    />
  );
}

function EmptyState() {
  return (
    <div className="mt-8 flex flex-col items-center rounded-lg border-2 border-border bg-card px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Compass className="size-8" />
      </span>
      <h2 className="mt-5 text-2xl">See what you can take next</h2>
      <p className="mt-2 max-w-lg text-lg text-muted-foreground">
        Import your transcript and this page lists the courses you can take next
        term, and the ones you still need to graduate.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <Button asChild>
          <Link href="/profile">
            <FileUp aria-hidden />
            Import your transcript
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/courses">Browse courses</Link>
        </Button>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mt-8 flex flex-col gap-10">
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <div
        aria-hidden
        className="h-44 rounded-lg border-2 border-border bg-card p-6"
      >
        <div className="h-6 w-60 rounded-sm bg-muted motion-safe:animate-pulse" />
        <div className="mt-5 h-4 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      <div aria-hidden>
        <div className="mb-4 h-7 w-44 rounded-sm bg-muted motion-safe:animate-pulse" />
        <CourseRowSkeleton rows={5} />
      </div>
    </div>
  );
}
