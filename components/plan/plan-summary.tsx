"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CourseCode } from "@/components/course-code";
import { CatalogueLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { StatusBar } from "@/components/status";
import { ShowMore } from "@/components/ui/disclosure";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { courseSlug } from "@/lib/catalogue/slug";
import { COPY } from "@/lib/copy";
import {
  creditSources,
  type GroupProgress,
  lacking,
  type ProgramProgress,
  programSplit,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { creditsText, sentence } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import type { Group, Program } from "@/lib/programs/types";

interface Standing {
  program: Program;
  progress: ProgramProgress;
}

/** Rows shown before Show N more. */
const VISIBLE = 6;

/** Rule text can run to a paragraph, which has no place in a row. */
const brief = (text: string) =>
  text.length > 100 ? `${text.slice(0, 99).trimEnd()}…` : text;

/** A missing course as its subject tag, linking to its page when the catalogue has it. */
function CourseTag({
  code,
  catalogue,
}: {
  code: string;
  catalogue: Catalogue;
}) {
  const course = catalogue.get(code);
  if (!course) {
    return (
      <span className="font-semibold">
        <CourseCode code={code} />
      </span>
    );
  }
  return (
    <Link
      href={`/courses/${courseSlug(code)}`}
      prefetch={false}
      title={course.title}
      className="rounded-[4px] font-semibold hover:underline"
    >
      <CourseCode code={code} />
    </Link>
  );
}

/** A group's credits split by the status of the courses it claimed, with what is left in grey. */
function GroupBar({
  group,
  snapshot,
}: {
  group: GroupProgress;
  snapshot: Snapshot;
}) {
  let completed = 0;
  let inProgress = 0;
  let planned = 0;
  for (const { code, credits } of group.courses) {
    if (snapshot.done.has(code)) completed += credits;
    else if (snapshot.inProgress.has(code)) inProgress += credits;
    else planned += credits;
  }
  const whole = Math.max(group.credits, completed + inProgress + planned);
  const parts = [
    { key: "completed", value: completed, fill: "bg-completed" },
    { key: "in-progress", value: inProgress, fill: "bg-in-progress" },
    { key: "planned", value: planned, fill: "bg-planned" },
  ].filter((part) => part.value > 0);
  return (
    <span
      role="img"
      aria-label={`${completed} completed, ${inProgress} in progress and ${planned} planned of ${group.credits} credits`}
      className="flex h-1.5 w-12 shrink-0 gap-0.5 overflow-hidden rounded-[3px] bg-line"
    >
      {parts.map((part) => (
        <span
          key={part.key}
          className={part.fill}
          style={{ width: `${(part.value / whole) * 100}%` }}
        />
      ))}
    </span>
  );
}

const ROW =
  "grid min-h-11 grid-cols-[17rem_minmax(0,1fr)_9rem] items-center gap-6 border-line border-b py-2";

/** "Minor" before a minor group's name, so it reads apart from the program's. */
const MinorPrefix = ({ minor }: { minor: boolean }) =>
  minor && <span className="font-normal text-fg-muted">Minor · </span>;

/** What an open group lacks: the required courses as tags, or the credits a list still needs. Null when only rules to check are left. */
function lacks(
  group: GroupProgress,
  definition: Group | undefined,
  catalogue: Catalogue,
): ReactNode {
  if (group.kind === "required") {
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {group.remaining.map((item) => {
          const codes = typeof item === "string" ? [item] : item.oneOf;
          return (
            <span key={codes.join()} className="flex gap-x-1.5">
              {codes.map((code, i) => (
                <Fragment key={code}>
                  {i > 0 && <span className="text-fg-muted">or</span>}
                  <CourseTag code={code} catalogue={catalogue} />
                </Fragment>
              ))}
            </span>
          );
        })}
      </span>
    );
  }
  const gap = group.credits - group.creditsDone;
  const from =
    definition?.kind === "complementary" ? creditSources(definition) : null;
  const what =
    gap > 0
      ? `Any ${creditsText(gap)}${from ? ` from ${from}` : ""}`
      : lacking(group);
  return (
    what && (
      <span className="text-fg-muted">
        {what} ·{" "}
        <Link href="/next" prefetch={false} className="link">
          See choices
        </Link>
      </span>
    )
  );
}

/** One row per open requirement of the program, then of the minor, and one per rule nobody could read. */
function missingRows(
  standings: (Standing & { minor: boolean })[],
  snapshot: Snapshot,
  catalogue: Catalogue,
) {
  return standings.flatMap(({ program, progress, minor }) =>
    progress.groups.flatMap((group, g) => {
      if (group.satisfied) return [];
      const key = `${program.id}-${g}`;
      const what = lacks(group, program.groups[g], catalogue);
      const gap = group.credits - group.creditsDone;
      const checks = group.rules.flatMap((rule, r) =>
        rule.unparsed
          ? [
              // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share a title and the list never reorders
              <li key={`${key}-${r}`} className={ROW}>
                <span className="flex items-center gap-2 font-medium">
                  <TriangleAlert
                    aria-hidden
                    className="size-4 shrink-0 text-warn"
                  />
                  <span>
                    <MinorPrefix minor={minor} />
                    {COPY.checkRequirement}
                  </span>
                </span>
                <span className="text-fg-muted">
                  {brief(rule.title)}{" "}
                  <span className="whitespace-nowrap">
                    · <CatalogueLink href={program.source} />
                  </span>
                </span>
              </li>,
            ]
          : [],
      );
      if (!what) return checks;
      return [
        <li key={key} className={ROW}>
          <span className="font-medium">
            <MinorPrefix minor={minor} />
            {sentence(group.title)}
          </span>
          {what}
          <span className="flex items-center justify-end gap-3 tabular-nums">
            <GroupBar group={group} snapshot={snapshot} />
            <span className="w-16 text-right">
              {gap > 0 && (
                <>
                  <span className="font-semibold">{gap}</span>{" "}
                  <span className="text-fg-muted">to go</span>
                </>
              )}
            </span>
          </span>
        </li>,
        ...checks,
      ];
    }),
  );
}

/** The plan's headline: program credits with the plan, what is still missing, the minor, and the warning count. */
export function PlanSummary({
  standing,
  minor,
  snapshot,
  catalogue,
  warningCount,
  onShowWarnings,
  graduationPassed,
}: {
  standing: Standing | null;
  /** The student's minor, counted on its own from the same courses. */
  minor: Standing | null;
  snapshot: Snapshot;
  catalogue: Catalogue;
  warningCount: number;
  onShowWarnings: () => void;
  /** The graduation term's label when it is already in the past. */
  graduationPassed: string | null;
}) {
  const warnings = warningCount > 0 && (
    <p className="shrink-0 font-semibold text-warn">
      <TriangleAlert aria-hidden className="mr-2 inline size-4 align-[-3px]" />
      <Term
        def={{ ...GLOSSARY.warnings, label: COPY.warnings(warningCount) }}
      />
      {" · "}
      <button
        type="button"
        onClick={onShowWarnings}
        className="rounded-md underline decoration-1 underline-offset-3"
      >
        Show
      </button>
    </p>
  );
  const standings = [
    ...(standing ? [{ ...standing, minor: false }] : []),
    ...(minor ? [{ ...minor, minor: true }] : []),
  ];
  const rows = missingRows(standings, snapshot, catalogue);
  const short = standing
    ? standing.progress.credits - standing.progress.creditsDone
    : 0;
  const hasChecks = (program: Program) =>
    standings.some(
      (row) =>
        row.program === program &&
        row.progress.groups.some((group) => group.unparsed > 0),
    );
  const met =
    standing !== null && standings.every(({ progress }) => progress.satisfied);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-8">
        {standing ? (
          <h1 className="tabular-nums">
            {standing.progress.creditsDone} of {standing.progress.credits}{" "}
            program credits <Term def={GLOSSARY.withPlan} />
          </h1>
        ) : (
          <>
            <h1 className="sr-only">Planner</h1>
            <p>
              <Link href="/profile#program" className="link">
                {COPY.pickProgram}
              </Link>{" "}
              to see what your plan still needs.
            </p>
          </>
        )}
        {warnings}
      </div>
      {standing && (
        <div className="mt-4">
          <StatusBar
            {...programSplit(standing.progress, snapshot)}
            total={standing.progress.credits}
            legend
            className="w-80"
          />
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1 empty:hidden">
        {graduationPassed && (
          <Notice tone="warn">
            Your expected graduation, {graduationPassed}, has passed.{" "}
            <Link href="/profile#graduation" className="link">
              Update it on your profile
            </Link>
            .
          </Notice>
        )}
        {met && (
          <p>
            Your plan meets every requirement of{" "}
            {standings
              .map(({ program }, i) =>
                i === 0 ? program.name : COPY.minorTitle(program.name),
              )
              .join(" and ")}
            .
          </p>
        )}
        {minor && (
          <p>
            {COPY.minorFigure(
              minor.program.name,
              minor.progress.creditsDone,
              minor.progress.credits,
              "plan",
            )}
            {minor.program.generated && (
              <>
                {" · "}
                <GeneratedNote hasChecks={hasChecks(minor.program)} />
                {" · "}
                <CatalogueLink href={minor.program.source} />
              </>
            )}
          </p>
        )}
        {standing?.program.generated && (
          <p>
            <GeneratedNote hasChecks={hasChecks(standing.program)} />
            {" · "}
            <CatalogueLink href={standing.program.source} />
          </p>
        )}
      </div>

      {!met && rows.length > 0 && (
        <div className="mt-6">
          <Section
            title={
              short > 0
                ? `Your plan is ${creditsText(short)} short`
                : "What your plan still misses"
            }
            meta={`${rows.length} ${rows.length === 1 ? "requirement" : "requirements"} still open`}
          >
            <ul className="border-line border-t">{rows.slice(0, VISIBLE)}</ul>
            {rows.length > VISIBLE && (
              <ShowMore count={rows.length - VISIBLE}>
                <ul>{rows.slice(VISIBLE)}</ul>
              </ShowMore>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
