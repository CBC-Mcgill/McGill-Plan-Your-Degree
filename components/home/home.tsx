"use client";

import { cn } from "cn";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { CourseCode } from "@/components/course-code";
import { ROW, ROW_LINK, ROW_TITLE } from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import { Landing } from "@/components/home/landing";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { Sentence as WarningSentence } from "@/components/plan/term-warnings";
import {
  STATUS,
  type Status,
  StatusBar,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { CARD, Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { degreeStanding } from "@/lib/engine/credits";
import { nextView, termSnapshot } from "@/lib/engine/next-view";
import { list } from "@/lib/engine/parts";
import { planLoads, planWarnings, termRange } from "@/lib/engine/plan";
import {
  type CreditSplit,
  creditSources,
  creditSplit,
  type GroupProgress,
  lacking,
  programStanding,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { creditsText, sentence } from "@/lib/format";
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
import type { Group, Program } from "@/lib/programs/types";

const OPEN_LIMIT = 5;
/** Full time at McGill, the "12 credits" of `GLOSSARY.fullTime`. */
const FULL_TIME_CREDITS = 12;

/** The landing page for visitors and the dashboard for students. Nobody sees either until the profile has loaded. */
export function Home() {
  const snapshot = useSnapshot();
  if (snapshot === null) return <Landing />;
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      {snapshot ? <Dashboard snapshot={snapshot} /> : <Skeleton />}
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
        <div className={cn(bone, "h-9 w-[440px]")} />
        <div className={cn(bone, "mt-2 h-5 w-[360px]")} />
        <div className={cn(bone, "mt-6 h-1.5 w-full")} />
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div className={cn(CARD, "h-80")} />
          <div className={cn(CARD, "h-80")} />
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

/** The screen's one red action and where it sits: under the headline for setup, in the card it is about otherwise. */
interface Step {
  place: "top" | "requirements" | "term";
  href: string;
  label: string;
  text: ReactNode;
}

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
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const term = useMemo(() => planTermOptions([])[0] ?? currentTerm(), []);
  const warnings = useMemo(
    () =>
      catalogue
        ? planWarnings(plan, snapshot, catalogue, creditLimit, graduation)
        : [],
    [plan, snapshot, catalogue, creditLimit, graduation],
  );

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

  const [warning] = warnings;
  const termLoad = catalogue
    ? planLoads(plan, catalogue)
        .filter((load) => termKey(load.term) === termKey(term))
        .reduce((sum, load) => sum + load.credits, 0)
    : 0;
  const short = FULL_TIME_CREDITS - termLoad;
  const step: Step | null =
    records.length === 0
      ? {
          place: "top",
          href: "/profile",
          label: COPY.importTranscript,
          text: "Import your transcript to fill in your courses.",
        }
      : !program
        ? {
            place: "requirements",
            href: "/profile#program",
            label: COPY.pickProgram,
            text: "Pick your program to see what you still need.",
          }
        : !graduation
          ? {
              place: "top",
              href: "/profile#graduation",
              label: "Set graduation term",
              text: "Set your expected graduation term to see how many terms are left.",
            }
          : passed
            ? {
                place: "top",
                href: "/profile#graduation",
                label: "Update graduation term",
                text: `Your expected graduation, ${COPY.term(graduation)}, has passed.`,
              }
            : warning && catalogue
              ? {
                  place: "term",
                  href: "/plan",
                  label: "Open planner",
                  text: (
                    <>
                      {COPY.warnings(warnings.length)} in your plan:{" "}
                      <WarningSentence
                        warning={warning}
                        snapshot={snapshot}
                        catalogue={catalogue}
                        plan={plan}
                      />
                    </>
                  ),
                }
              : short > 0
                ? {
                    place: "term",
                    href: "/next",
                    label: "See courses",
                    text: (
                      <>
                        {short} more {short === 1 ? "credit" : "credits"} to be{" "}
                        <Term def={GLOSSARY.fullTime}>full time</Term>.
                      </>
                    ),
                  }
                : null;

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
      {known && (program || pending > 0 || termsLeft > 0) && (
        <p className="mt-2 text-fg-muted tabular-nums">
          {program && `${program.name}. `}
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
        <DegreeBar
          split={{ completed: earned, inProgress, planned }}
          total={required}
        />
      )}
      {catalogue && step?.place === "top" && (
        <Card className="mt-8 px-5 py-4">
          <StepRow step={step} />
        </Card>
      )}
      {catalogue === null ? (
        <div className={cn(known && "mt-8")}>
          <CatalogueError />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 items-start gap-6">
          <Requirements
            snapshot={snapshot}
            catalogue={catalogue}
            program={program}
            required={required}
            step={step?.place === "requirements" ? step : null}
          />
          <div className="flex flex-col gap-6">
            <ThisTerm
              snapshot={snapshot}
              catalogue={catalogue}
              credits={inProgress}
            />
            <NextTerm
              snapshot={snapshot}
              catalogue={catalogue}
              program={program}
              term={term}
              credits={termLoad}
              step={step?.place === "term" ? step : null}
            />
          </div>
        </div>
      )}
    </>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p>{step.text}</p>
      <Button asChild>
        <Link href={step.href}>{step.label}</Link>
      </Button>
    </div>
  );
}

const LEGEND = [
  ["completed", "completed", "earned"],
  ["in-progress", "inProgress", "in progress"],
  ["planned", "planned", "planned"],
] as const;

/** The degree's credits as one bar across the page, with each part worded below and what is left to go. */
function DegreeBar({ split, total }: { split: CreditSplit; total: number }) {
  const left = Math.max(
    0,
    total - split.completed - split.inProgress - split.planned,
  );
  return (
    <div className="mt-6">
      <StatusBar {...split} total={total} className="w-full" />
      <p
        aria-hidden
        className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-fg-muted tabular-nums"
      >
        {LEGEND.map(([status, key, word]) => (
          <span key={key} className="inline-flex items-center gap-2">
            <StatusIcon status={status} />
            <span>
              <span
                className="font-semibold"
                style={{ color: STATUS[status].text }}
              >
                {split[key]}
              </span>{" "}
              {word}
            </span>
          </span>
        ))}
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-[3px] bg-line" />
          <span>
            <span className="font-semibold text-fg">{left}</span> to go
          </span>
        </span>
      </p>
    </div>
  );
}

const either = new Intl.ListFormat("en-GB", { type: "disjunction" });

/** What a requirement still lacks once the plan is done, in one sentence. */
function partNote(group: GroupProgress, definition: Group | undefined) {
  if (group.credited) return "Credited from CEGEP.";
  if (group.kind === "required") {
    const left = group.remaining.map((item) =>
      typeof item === "string" ? item : either.format(item.oneOf),
    );
    if (left.length === 0)
      return "Every course is done, in progress or planned.";
    return left.length <= 3
      ? `${list.format(left)} left to plan.`
      : `${left.length} courses left to plan, such as ${left[0]}.`;
  }
  const gap = group.credits - group.creditsDone;
  if (gap > 0) {
    const from =
      definition?.kind === "complementary" ? creditSources(definition) : null;
    return `${creditsText(gap)} left to choose${from ? ` from ${from}` : ""}.`;
  }
  const lacks = lacking(group);
  if (lacks) return `${lacks}.`;
  return group.unparsed > 0
    ? "Check its rules on What's next."
    : "Every credit is done, in progress or planned.";
}

/** One requirement: its name, the credits earned of what it needs, its bar and what is left. */
function Part({
  title,
  split,
  total,
  note,
}: {
  title: string;
  split: CreditSplit;
  total: number;
  note: string;
}) {
  return (
    <li className="-mx-5 border-line border-t px-5 py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3>{title}</h3>
        <p className="shrink-0 text-fg-muted tabular-nums">
          <span className="font-semibold text-fg">{split.completed}</span> of{" "}
          {COPY.credits(total)}
        </p>
      </div>
      <StatusBar {...split} total={total} className="mt-3 w-full" />
      <p className="mt-2 text-fg-muted">{note}</p>
    </li>
  );
}

function Requirements({
  snapshot,
  catalogue,
  program,
  required,
  step,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  required: number | null;
  step: Step | null;
}) {
  const entry = useProfileStore((state) => state.entry);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const progress = useMemo(
    () =>
      program && programStanding(program, snapshot, catalogue, entry, "plan"),
    [program, snapshot, catalogue, entry],
  );
  // The degree's credits beyond the program's are free for electives, a minor included.
  const electives =
    program && progress && required !== null && required > program.credits
      ? {
          total: required - program.credits,
          split: creditSplit(
            {
              credited: false,
              credits: required - program.credits,
              courses: [
                ...progress.unclaimed,
                // Advanced standing is earned credit with no course behind it.
                { code: "", credits: advancedStanding },
              ],
            },
            snapshot,
          ),
        }
      : null;

  return (
    <Section title="Requirements" meta="Credits toward each part">
      {program && progress ? (
        <ul>
          {progress.groups.map((group, index) => (
            <Part
              // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
              key={index}
              title={sentence(group.title)}
              split={creditSplit(group, snapshot)}
              total={group.credits}
              note={partNote(group, program.groups[index])}
            />
          ))}
          {electives && (
            <Part
              title="Electives"
              split={electives.split}
              total={electives.total}
              note="Any course outside your program counts here."
            />
          )}
        </ul>
      ) : step ? (
        <StepRow step={step} />
      ) : (
        <p className="text-fg-muted">
          <Link href="/profile#program" className="link font-semibold">
            {COPY.pickProgram}
          </Link>{" "}
          to see what you still need.
        </p>
      )}
    </Section>
  );
}

/** A course in a term card: glyph, subject tag and title linking to the course, credits, and an action on hover and focus. */
function TermRow({
  course,
  label = course.code,
  status,
  uncertain = false,
  action,
}: {
  course: CourseSummary;
  /** The part, such as ECSE 458D2, when only one part falls in the term. */
  label?: string;
  status: Status;
  uncertain?: boolean;
  action?: ReactNode;
}) {
  return (
    <li className={ROW}>
      <span className={ROW_TITLE}>
        <StatusTip status={status} className="flex min-w-0 gap-2">
          <span className="flex h-5 w-4 shrink-0 items-center">
            <StatusIcon status={status} label={STATUS[status].label} />
          </span>
          <Link
            href={`/courses/${courseSlug(course.code)}`}
            prefetch={false}
            className={ROW_LINK}
          >
            <span className="w-24 shrink-0 font-semibold tabular-nums">
              <CourseCode code={label} />
            </span>
            <span className="min-w-0 truncate" title={course.title}>
              {course.title}
            </span>
          </Link>
        </StatusTip>
        {uncertain && <UncertainFlag />}
      </span>
      <span className="shrink-0 whitespace-nowrap text-fg-muted tabular-nums">
        <CreditsLabel course={course} bare />
      </span>
      {action && (
        <span className="-my-2 flex w-20 shrink-0 justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          {action}
        </span>
      )}
    </li>
  );
}

/** The courses in progress, under the term they were registered in. Nothing when there are none. */
function ThisTerm({
  snapshot,
  catalogue,
  credits,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  credits: number;
}) {
  const courses = [...snapshot.inProgress.keys()].flatMap(
    (code) => catalogue.get(code) ?? [],
  );
  if (courses.length === 0) return null;
  const term =
    [...snapshot.inProgress.values()]
      .flatMap((term) => term ?? [])
      .sort(compareTerms)
      .at(-1) ?? currentTerm();
  return (
    <Section
      title={COPY.term(term)}
      meta={
        <span className="text-in-progress">
          {COPY.credits(credits)} in progress
        </span>
      }
    >
      <ul>
        {courses.map((course) => (
          <TermRow key={course.code} course={course} status="in-progress" />
        ))}
      </ul>
    </Section>
  );
}

/** The next term: what is planned in it, the required courses open in it and not planned yet, and the plan's red action. */
function NextTerm({
  snapshot,
  catalogue,
  program,
  term,
  credits,
  step,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  term: AcademicTerm;
  credits: number;
  step: Step | null;
}) {
  const plan = useProfileStore((state) => state.plan);
  const entry = useProfileStore((state) => state.entry);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const view = useMemo(
    () =>
      program &&
      nextView(
        catalogue,
        termSnapshot(snapshot, plan, term),
        term,
        program,
        entry,
      ),
    [catalogue, snapshot, plan, term, program, entry],
  );
  const loads = planLoads(plan, catalogue).filter(
    (load) => termKey(load.term) === termKey(term),
  );
  const inPlan = new Set(plan.flatMap((entry) => entry.courses));
  // An alternative with a reason is not open, so it stays on What's next.
  const open = (view?.mustTake ?? [])
    .flatMap((item) => ("oneOf" in item ? item.oneOf : [item]))
    .filter((item) => !item.reason && !inPlan.has(item.course.code));
  const label = COPY.term(term);

  return (
    <Section title={label} meta={COPY.termLoad(credits, creditLimit)}>
      {loads.length > 0 ? (
        <ul>
          {loads.flatMap((load) => {
            const course = catalogue.get(load.code);
            return course
              ? [
                  <TermRow
                    key={load.label}
                    course={course}
                    label={load.label}
                    status="planned"
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => removeWithUndo(load.start, load.code)}
                      >
                        Remove
                        <span className="sr-only"> {load.label}</span>
                      </Button>
                    }
                  />,
                ]
              : [];
          })}
        </ul>
      ) : (
        <p className="text-fg-muted">Nothing planned yet.</p>
      )}
      {open.length > 0 && (
        <>
          <h3 className="mt-5 pb-1 font-normal text-fg-muted">
            Required and open, not planned yet
          </h3>
          <ul className="-mx-5 border-line border-t px-5">
            {open.slice(0, OPEN_LIMIT).map(({ course, uncertain }) => (
              <TermRow
                key={course.code}
                course={course}
                status="available"
                uncertain={uncertain}
                action={
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
                }
              />
            ))}
          </ul>
        </>
      )}
      {open.length > OPEN_LIMIT && (
        <p className="mt-3">
          <Link href="/next" className="link font-semibold">
            See all {open.length} in What's next
          </Link>
        </p>
      )}
      {step && (
        <div className="-mx-5 -mb-4 mt-4 border-line border-t px-5 py-4">
          <StepRow step={step} />
        </div>
      )}
    </Section>
  );
}
