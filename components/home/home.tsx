"use client";

import { cn } from "cn";
import { ArrowRight, GraduationCap, Star } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { Landing } from "@/components/home/landing";
import { SetupGuide } from "@/components/home/setup-guide";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { StatusIcon, UncertainFlag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";
import {
  degreeCredits,
  earnedCredits,
  pendingCredits,
} from "@/lib/engine/credits";
import { type Entry, nextView } from "@/lib/engine/next-view";
import { creditsLabel } from "@/lib/engine/parts";
import { termRange } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { recordCredits } from "@/lib/engine/stages";
import { creditsText } from "@/lib/format";
import { XP_PER_LEVEL } from "@/lib/game/progress";
import { useGameProgress } from "@/lib/game/use-game-progress";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  planTermOptions,
  termLabel,
} from "@/lib/profile/term-options";
import {
  type CourseRecord,
  compareTerms,
  earnsCredit,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { getProgram } from "@/lib/programs";
import type { Program } from "@/lib/programs/types";

const NEXT_UP_LIMIT = 5;
const BAR_TERMS = 6;
const NO_COURSES: ReadonlySet<string> = new Set();

/** The marketing page for visitors. A student with a profile gets their own home, and nobody sees either until the profile has loaded. */
export function Home() {
  const snapshot = useSnapshot();
  if (snapshot === undefined) return <HomeSkeleton />;
  return snapshot ? <Dashboard snapshot={snapshot} /> : <Landing />;
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[59rem] px-8 py-10">
      <div aria-hidden>
        <div className="h-[34px] w-56 rounded-sm bg-muted motion-safe:animate-pulse" />
        <div className="mt-1 h-5 w-72 rounded-sm bg-muted motion-safe:animate-pulse" />
      </div>
      <Skeleton />
    </div>
  );
}

// Split out so a visitor without a profile does not download the catalogue.
function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();
  return (
    <div className="mx-auto w-full max-w-[59rem] px-8 py-10">
      <h1>Welcome back</h1>
      <p className="mt-1 text-muted-foreground">
        Here is where your degree stands today.
      </p>
      {catalogue.status === "ready" ? (
        <Ready snapshot={snapshot} catalogue={catalogue.catalogue} />
      ) : catalogue.status === "error" ? (
        <div className="mt-6">
          <CatalogueError />
        </div>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}

function Ready({
  snapshot,
  catalogue,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
}) {
  const programId = useProfileStore((state) => state.programId);
  const entry = useProfileStore((state) => state.entry);
  const term = useMemo(() => planTermOptions([])[0] ?? currentTerm(), []);
  const program = programId ? (getProgram(programId) ?? null) : null;
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

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Metrics
        snapshot={snapshot}
        catalogue={catalogue}
        program={program}
        term={term}
      />
      <SetupGuide
        snapshot={snapshot}
        catalogue={catalogue}
        program={program}
        term={term}
      />
      <NextUp
        mustTake={view.mustTake.flatMap((item) =>
          "oneOf" in item ? item.oneOf : [item],
        )}
        hasProgram={program !== null}
        term={term}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <div aria-hidden className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-[104px] motion-safe:animate-pulse" />
        ))}
      </div>
      <Card aria-hidden className="h-72 motion-safe:animate-pulse" />
    </div>
  );
}

/** Credits per term, oldest first, with the term in progress last. */
function termBars(records: CourseRecord[], catalogue: Catalogue) {
  const byTerm = new Map<
    number,
    { term: Term; credits: number; current: boolean }
  >();
  for (const record of records) {
    const counts =
      earnsCredit(record.status) || record.status === "in-progress";
    if (!record.term || !counts) continue;
    const key = termKey(record.term);
    const row = byTerm.get(key) ?? {
      term: record.term,
      credits: 0,
      current: false,
    };
    row.credits += recordCredits(record, catalogue);
    row.current ||= record.status === "in-progress";
    byTerm.set(key, row);
  }
  return [...byTerm.values()]
    .sort((a, b) => compareTerms(a.term, b.term))
    .slice(-BAR_TERMS);
}

function Metrics({
  snapshot,
  catalogue,
  program,
  term,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  term: Term;
}) {
  const records = useProfileStore((state) => state.records);
  const entry = useProfileStore((state) => state.entry);
  const creditsRequired = useProfileStore((state) => state.creditsRequired);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const game = useGameProgress();

  const earned = earnedCredits(snapshot, catalogue) + advancedStanding;
  const pending = pendingCredits(snapshot);
  const required = degreeCredits(creditsRequired, entry, program);
  const bars = useMemo(
    () => termBars(records, catalogue),
    [records, catalogue],
  );
  const peak = Math.max(1, ...bars.map((bar) => bar.credits));
  const termsLeft = graduationTerm
    ? termRange(term, graduationTerm).length
    : null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Metric label="Credits earned">
        <div className="flex items-end justify-between gap-3">
          <Value>{earned}</Value>
          <div
            role="img"
            aria-label={`Credits per term: ${bars.map((bar) => bar.credits).join(", ")}`}
            className="flex h-8 items-end gap-1"
          >
            {bars.map((bar) => (
              <span
                key={termKey(bar.term)}
                title={`${termLabel(bar.term)}: ${bar.credits} credits${bar.current ? ", in progress" : ""}`}
                className={cn(
                  "w-2 rounded-[2px]",
                  bar.current ? "bg-in-progress/40" : "bg-completed",
                )}
                style={{
                  height: `${Math.max(12, (bar.credits / peak) * 100)}%`,
                }}
              />
            ))}
          </div>
        </div>
        <Caption>
          {pending > 0 ? (
            <span title="Credit for a multi-term course arrives when its last part is done">
              {required && `of ${required} · `}
              {creditsText(pending)} pending
            </span>
          ) : required ? (
            `of ${required} toward your degree`
          ) : (
            "toward your degree"
          )}
        </Caption>
      </Metric>

      <Metric label="Level">
        <div className="flex items-center justify-between gap-3">
          <Value>{game ? game.level : "-"}</Value>
          <span className="relative flex size-10 items-center justify-center">
            <ProgressRing
              value={game?.xpIntoLevel ?? 0}
              max={XP_PER_LEVEL}
              size={40}
              fill="xp"
              label={
                game
                  ? `${game.xpToNextLevel} XP to level ${game.level + 1}`
                  : undefined
              }
            />
            <Star
              aria-hidden
              className="absolute size-4 fill-xp text-xp"
              strokeWidth={1.75}
            />
          </span>
        </div>
        <Caption>
          {game
            ? `${game.xpToNextLevel.toLocaleString("en-US")} XP to level ${game.level + 1}`
            : "Loading"}
        </Caption>
      </Metric>

      <Metric label="Terms left">
        <div className="flex items-center justify-between gap-3">
          <Value>{termsLeft ?? "-"}</Value>
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-md bg-subtle text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <GraduationCap className="size-5" strokeWidth={1.75} />
          </span>
        </div>
        <Caption>
          {graduationTerm
            ? compareTerms(graduationTerm, currentTerm()) < 0
              ? "Graduation date has passed"
              : `Until ${termLabel(graduationTerm)}`
            : "Set your graduation term"}
        </Caption>
      </Metric>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="font-medium text-[13px] text-muted-foreground leading-[18px]">
        {label}
      </p>
      {children}
    </Card>
  );
}

const Value = ({ children }: { children: ReactNode }) => (
  <p className="font-semibold text-[28px] leading-10 tracking-tight tabular-nums">
    {children}
  </p>
);

const Caption = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground text-xs leading-4">{children}</p>
);

function NextUp({
  mustTake,
  hasProgram,
  term,
}: {
  mustTake: Entry[];
  hasProgram: boolean;
  term: Term;
}) {
  const plan = useProfileStore((state) => state.plan);
  const label = termLabel(term);
  const plannedIn = (code: string) =>
    plan.find((entry) => entry.courses.includes(code))?.term;
  const shown = mustTake.slice(0, NEXT_UP_LIMIT);
  return (
    <Card asChild className="overflow-hidden">
      <section aria-labelledby="next-up-title">
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            <h2 id="next-up-title" className="text-base leading-6">
              Next up for {label}
            </h2>
            <p className="text-[13px] text-muted-foreground leading-[18px]">
              Required courses you can take now.
            </p>
          </div>
          <Link
            href="/next"
            className="inline-flex items-center gap-1 rounded-sm font-medium text-in-progress hover:underline"
          >
            See all options
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        {shown.length > 0 ? (
          <ul>
            {shown.map(({ course, uncertain }) => {
              const at = plannedIn(course.code);
              return (
                <li
                  key={course.code}
                  className="flex h-11 items-center gap-3 border-border border-t px-5"
                >
                  <StatusIcon
                    status={at ? "planned" : "available"}
                    label={at ? `Planned for ${termLabel(at)}` : undefined}
                  />
                  <Link
                    href={`/courses/${courseSlug(course.code)}`}
                    prefetch={false}
                    className="w-[76px] shrink-0 font-semibold tabular-nums hover:underline"
                  >
                    {course.code}
                  </Link>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate" title={course.title}>
                      {course.title}
                    </span>
                    {uncertain && <UncertainFlag />}
                  </span>
                  {at && (
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      Planned for {termLabel(at)}
                    </span>
                  )}
                  <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-muted-foreground tabular-nums">
                    {creditsLabel(course)}
                  </span>
                  <span className="flex w-[84px] shrink-0 justify-end">
                    {at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWithUndo(at, course.code)}
                      >
                        Remove
                        <span className="sr-only"> {course.code}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground"
                        onClick={() => addWithUndo(term, course.code)}
                      >
                        Add
                        <span className="sr-only">
                          {" "}
                          {course.code} to {label}
                        </span>
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
            {mustTake.length > shown.length && (
              <li className="flex h-11 items-center gap-3 border-border border-t px-5 text-[13px] text-muted-foreground">
                Showing {shown.length} of {mustTake.length}
                <Link
                  href="/next"
                  className="rounded-sm font-medium text-in-progress hover:underline"
                >
                  See all {mustTake.length}
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <p className="border-border border-t px-5 py-4 text-muted-foreground">
            {hasProgram
              ? `No required course is open in ${label}. See all options for other courses you can take.`
              : "Pick your program to see which required courses you can take next."}
          </p>
        )}
      </section>
    </Card>
  );
}
