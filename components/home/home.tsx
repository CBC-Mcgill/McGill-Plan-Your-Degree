"use client";

import { cn } from "cn";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { CourseRow } from "@/components/course-row";
import { Landing } from "@/components/home/landing";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { Sentence as WarningSentence } from "@/components/plan/term-warnings";
import { StatusBadge, StatusBar } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { COPY } from "@/lib/copy";
import { degreeStanding } from "@/lib/engine/credits";
import { nextView } from "@/lib/engine/next-view";
import { planWarnings, termLoad, termRange } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm, planTermOptions } from "@/lib/profile/term-options";
import {
  type Term as AcademicTerm,
  compareTerms,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import type { Program } from "@/lib/programs/types";

const NEXT_UP_LIMIT = 5;
/** Full time at McGill, the "12 credits" of `GLOSSARY.fullTime`. */
const FULL_TIME_CREDITS = 12;
const NO_COURSES: ReadonlySet<string> = new Set();

/** The landing page for visitors and the dashboard for students. Nobody sees either until the profile has loaded. */
export function Home() {
  const snapshot = useSnapshot();
  if (snapshot === null) return <Landing />;
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <div className="max-w-reading">
        {snapshot ? <Dashboard snapshot={snapshot} /> : <Skeleton />}
      </div>
    </div>
  );
}

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

function Skeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <div aria-hidden>
        <div className={cn(bone, "h-11 w-[400px]")} />
        <div className={cn(bone, "mt-2 h-5 w-[560px]")} />
        <div className="mt-12">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex h-11 items-center gap-4">
              <div className={cn(bone, "h-5 w-24")} />
              <div className={cn(bone, "h-5 w-1/3")} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Split out so a visitor without a profile does not download the catalogue.
function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();
  const program = useProgram(useProfileStore((state) => state.programId));
  if (catalogue.status === "error" && program !== undefined) {
    return <Ready snapshot={snapshot} catalogue={null} program={program} />;
  }
  if (catalogue.status !== "ready" || program === undefined) {
    return <Skeleton />;
  }
  return (
    <Ready
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
    />
  );
}

const NO_CATALOGUE: Catalogue = new Map();

function Ready({
  snapshot,
  catalogue,
  program,
}: {
  snapshot: Snapshot;
  /** Null when the catalogue failed to load: the figures that need only records stay, the rest gives way to the notice. */
  catalogue: Catalogue | null;
  program: Program | null;
}) {
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const entry = useProfileStore((state) => state.entry);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const creditsRequired = useProfileStore((state) => state.creditsRequired);
  const graduation = useProfileStore((state) => state.graduationTerm);
  const term = useMemo(() => planTermOptions([])[0] ?? currentTerm(), []);

  const { earned, inProgress, planned, pending, required } = degreeStanding(
    snapshot,
    catalogue ?? NO_CATALOGUE,
    { records, plan, advancedStanding, creditsRequired, entry },
    program,
  );
  const passed =
    graduation !== null && compareTerms(graduation, currentTerm()) < 0;
  const termsLeft =
    graduation && !passed ? termRange(term, graduation).length : 0;
  const figure = COPY.degreeFigure(earned, required);
  const pendingText = COPY.pending(pending);

  // Without the catalogue a credit no record states is unknown, so no figure rather than a wrong one.
  const known =
    catalogue !== null || records.every((record) => record.credits !== null);

  return (
    <>
      <h1 className={cn(!known && "sr-only")}>
        {known ? (
          <>
            {figure.slice(0, -COPY.basis.earned.length)}
            <Term def={GLOSSARY.creditsEarned}>{COPY.basis.earned}</Term>
          </>
        ) : (
          "Your degree"
        )}
      </h1>
      {known && (inProgress > 0 || pending > 0 || termsLeft > 0) && (
        <p className="mt-2 text-fg-muted tabular-nums">
          {inProgress > 0 && `${COPY.credits(inProgress)} in progress. `}
          {pending > 0 && (
            <>
              {pendingText.slice(0, -GLOSSARY.pending.label.length)}
              <Term def={GLOSSARY.pending} />.{" "}
            </>
          )}
          {graduation &&
            termsLeft > 0 &&
            `${COPY.termsLeft(termsLeft, graduation)}.`}
        </p>
      )}
      {known && required !== null && (
        <div className="mt-4">
          <StatusBar
            completed={earned}
            inProgress={inProgress}
            planned={planned}
            total={required}
            legend
            className="w-80"
          />
        </div>
      )}
      {catalogue === null ? (
        <div className={cn(known && "mt-8")}>
          <CatalogueError />
        </div>
      ) : (
        <NextStep
          snapshot={snapshot}
          catalogue={catalogue}
          program={program}
          term={term}
          passed={passed}
        />
      )}
      {catalogue && program && (
        <RequiredCourses
          snapshot={snapshot}
          catalogue={catalogue}
          program={program}
          term={term}
        />
      )}
    </>
  );
}

/** The first thing left to set up or fix, with the screen's one red button. Nothing when all is done. */
function NextStep({
  snapshot,
  catalogue,
  program,
  term,
  passed,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  term: AcademicTerm;
  passed: boolean;
}) {
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const graduation = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const warnings = useMemo(
    () => planWarnings(plan, snapshot, catalogue, creditLimit, graduation),
    [plan, snapshot, catalogue, creditLimit, graduation],
  );
  const planned = termLoad(plan, catalogue, term);
  const [warning] = warnings;

  if (records.length === 0) {
    return (
      <Step href="/profile" label={COPY.importTranscript}>
        Import your transcript to fill in your courses.
      </Step>
    );
  }
  if (!program) {
    return (
      <Step href="/profile#program" label={COPY.pickProgram}>
        Pick your program to see what you still need.
      </Step>
    );
  }
  if (!graduation) {
    return (
      <Step href="/profile#graduation" label="Set graduation term">
        Set your expected graduation term to see how many terms are left.
      </Step>
    );
  }
  if (passed) {
    return (
      <Step href="/profile#graduation" label="Update graduation term">
        Your expected graduation, {COPY.term(graduation)}, has passed.
      </Step>
    );
  }
  if (warning) {
    return (
      <Step href="/plan" label="Open planner">
        {COPY.warnings(warnings.length)} in your plan:{" "}
        <WarningSentence
          warning={warning}
          snapshot={snapshot}
          catalogue={catalogue}
          plan={plan}
        />
      </Step>
    );
  }
  if (planned < FULL_TIME_CREDITS) {
    return (
      <Step href="/next" label="See courses">
        Plan at least <Term def={GLOSSARY.fullTime} /> for {COPY.term(term)}.{" "}
        {planned} so far.
      </Step>
    );
  }
  return null;
}

function Step({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      <p>{children}</p>
      <Button asChild>
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}

function RequiredCourses({
  snapshot,
  catalogue,
  program,
  term,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program;
  term: AcademicTerm;
}) {
  const plan = useProfileStore((state) => state.plan);
  const entry = useProfileStore((state) => state.entry);
  // Planned courses stay in the list, so adding one shows "Planned" and the row does not vanish.
  const view = useMemo(
    () =>
      nextView(
        catalogue,
        { ...snapshot, planned: NO_COURSES },
        term,
        program,
        entry,
      ),
    [catalogue, snapshot, term, program, entry],
  );
  // An alternative with a reason is not open, so it stays on What's next.
  const open = view.mustTake
    .flatMap((item) => ("oneOf" in item ? item.oneOf : [item]))
    .filter((item) => !item.reason);
  const label = COPY.term(term);
  const plannedIn = (code: string) =>
    plan.find((item) => item.courses.includes(code))?.term;

  return (
    <div className="mt-8">
      <Section title={`Required courses open in ${label}`}>
        {open.length > 0 ? (
          <ul>
            {open.slice(0, NEXT_UP_LIMIT).map(({ course, uncertain }) => {
              const at = plannedIn(course.code);
              return (
                <CourseRow
                  key={course.code}
                  course={course}
                  status={at ? "planned" : "available"}
                  showGlyph
                  uncertain={uncertain}
                  meta={
                    at &&
                    (termKey(at) === termKey(term) ? (
                      <StatusBadge status="planned" />
                    ) : (
                      COPY.plannedFor(at)
                    ))
                  }
                  action={
                    at ? (
                      <Button
                        variant="secondary"
                        onClick={() => removeWithUndo(at, course.code)}
                      >
                        Remove
                        <span className="sr-only"> {course.code}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => addWithUndo(term, course.code)}
                      >
                        Add
                        <span className="sr-only">
                          {" "}
                          {course.code} to {label}
                        </span>
                      </Button>
                    )
                  }
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-fg-muted">
            {view.later.length > 0
              ? `No required course is open in ${label}.`
              : "Every required course is done or in progress."}
          </p>
        )}
        {open.length > NEXT_UP_LIMIT && (
          <p className="mt-4">
            <Link href="/next" className="link font-semibold">
              See all {open.length} in What's next
            </Link>
          </p>
        )}
      </Section>
    </div>
  );
}
