"use client";

import { ChevronDown, Compass, FileUp, Info } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { AddToPlan, PlannedLink } from "@/components/add-to-plan";
import { CourseRow, CourseRowSkeleton } from "@/components/course-row";
import { StatusIcon, UncertainFlag } from "@/components/status";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
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
        <h1>What's next</h1>
        <p className="mt-1 text-muted-foreground">
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
          <SelectField
            label="Term"
            value={termKey(selected)}
            onChange={(event) => setPicked(Number(event.target.value))}
            className="w-44 shrink-0"
          >
            {options.map((option) => (
              <option key={termKey(option)} value={termKey(option)}>
                {termLabel(option)}
              </option>
            ))}
          </SelectField>
        )}
      </Header>

      {catalogue.status === "error" ? (
        <p role="alert" className="mt-6">
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
    <div className="mt-6 flex flex-col gap-8">
      {program && view.progress ? (
        <ProgramCard
          program={program}
          progress={view.progress}
          background={background}
          inProgress={inProgress}
        />
      ) : (
        <Card className="px-5 py-4">
          <Link
            href="/profile"
            className="font-medium underline underline-offset-2 hover:text-primary"
          >
            Pick your program
          </Link>{" "}
          to see which required courses you still need.
        </Card>
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
            <Card className="px-5 py-5 text-muted-foreground">
              {later.length > 0
                ? `No required course is open in ${termLabel(term)}. See what comes later below.`
                : "You have taken every required course. Nice work!"}
            </Card>
          )}
        </Section>
      )}

      {later.length > 0 && (
        <section aria-labelledby="later">
          <details open={later.length <= LATER_OPEN_LIMIT} className="group">
            <summary className="flex cursor-pointer list-none items-baseline gap-3 rounded-md [&::-webkit-details-marker]:hidden">
              <h2 id="later" className="text-lg">
                Required later
              </h2>
              <span className="font-medium text-muted-foreground">
                {later.length}
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-medium text-[13px] text-muted-foreground">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            <p className="mt-0.5 mb-3 text-muted-foreground">
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
          <div className="flex flex-col gap-4">
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
          <Card className="px-5 py-5 text-muted-foreground">
            Nothing else is open to you in {termLabel(term)}.
          </Card>
        )}
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/courses?status=available&term=${term.season}`}>
              See all courses you can take
            </Link>
          </Button>
          {other.length > OTHER_LIMIT && (
            <p className="text-[13px] text-muted-foreground">
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
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {count !== undefined && (
          <span className="font-medium text-muted-foreground">
            {count.toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-0.5 mb-3 text-muted-foreground">{hint}</p>
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
    <Card asChild className="p-5">
      <section aria-labelledby="program">
        <div className="flex items-baseline justify-between gap-6">
          <h2 id="program" className="text-base">
            {program.name}
          </h2>
          <p className="font-semibold tabular-nums">
            {creditsDone} of {credits} credits
          </p>
        </div>
        <ProgressBar
          value={creditsDone}
          max={credits}
          label={`${program.name} progress`}
          valueText={`${creditsDone} of ${credits} credits`}
          className="mt-3 h-2"
        />
        {inProgress && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Includes the courses you are taking now.
          </p>
        )}
        {degree && (
          <p className="mt-2 text-[13px]">
            <span className="font-medium">Earned so far:</span>{" "}
            <span className="tabular-nums">
              {degree.done}
              {degree.required !== credits && ` of ${degree.required}`} credits
            </span>
            {degree.advancedStanding > 0 && (
              <span className="text-muted-foreground">
                , including {degree.advancedStanding} advanced standing credits
              </span>
            )}
          </p>
        )}
        <ul className="mt-4 columns-2 gap-x-10">
          {progress.groups.map((group) => (
            <li
              key={group.title}
              className="flex break-inside-avoid items-center gap-2.5 pb-2 text-sm"
            >
              {group.satisfied ? (
                <StatusIcon status="completed" size={16} />
              ) : (
                <ProgressRing
                  value={group.creditsDone}
                  max={group.credits}
                  size={16}
                />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">
                {group.title}
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
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
              <li key={code}>
                <Banner>
                  <Info aria-hidden />
                  <span>
                    {code} was exempted without credit. Replace{" "}
                    {credits === null
                      ? "its credits"
                      : `its ${credits} ${credits === 1 ? "credit" : "credits"}`}{" "}
                    with another course.
                  </span>
                </Banner>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

function GroupCard({ group, context }: { group: OpenGroup; context: Context }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-border border-b bg-subtle px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-base">{group.title}</h3>
          <p className="font-medium text-[13px] tabular-nums">
            {group.creditsDone} of {group.credits} credits
          </p>
        </div>
        <ProgressBar
          value={group.creditsDone}
          max={group.credits}
          label={`${group.title} progress`}
          valueText={`${group.creditsDone} of ${group.credits} credits`}
          className="mt-2"
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
    </Card>
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
          <h4 className="font-semibold">{bucket.title}</h4>
          {bucket.progress && (
            <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
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
          <Button variant="secondary" size="sm" onClick={() => setAll(true)}>
            Show {hidden} more
          </Button>
        </div>
      )}
    </div>
  );
}

function Items({ items, context }: { items: Item[]; context: Context }) {
  return (
    <Card asChild className="divide-y divide-border overflow-hidden">
      <ul>
        {items.map((item) =>
          "oneOf" in item ? (
            <li
              key={item.oneOf.map((entry) => entry.course.code).join()}
              className="border-l-2 border-l-border-strong bg-subtle"
            >
              <p className="px-4 pt-3 pb-1 font-semibold text-[13px] text-muted-foreground">
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
    </Card>
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
              <span className="text-[13px] text-muted-foreground">
                {reason}
              </span>
            )}
            {uncertain && <UncertainFlag withLabel />}
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
    <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-lg bg-muted text-foreground"
      >
        <Compass className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-lg">See what you can take next</h2>
      <p className="mt-1 max-w-md text-muted-foreground">
        Import your transcript and this page lists the courses you can take next
        term, and the ones you still need to graduate.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild size="lg">
          <Link href="/profile">
            <FileUp aria-hidden />
            Import your transcript
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/courses">Browse courses</Link>
        </Button>
      </div>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <Card aria-hidden className="h-36 p-5">
        <div className="h-5 w-60 rounded-sm bg-muted motion-safe:animate-pulse" />
        <div className="mt-5 h-2 rounded-full bg-muted motion-safe:animate-pulse" />
      </Card>
      <div aria-hidden>
        <div className="mb-4 h-6 w-44 rounded-sm bg-muted motion-safe:animate-pulse" />
        <CourseRowSkeleton rows={5} />
      </div>
    </div>
  );
}
