"use client";

import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { CatalogueLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { Notice } from "@/components/ui/notice";
import { Term } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import { lacking, type ProgramProgress } from "@/lib/engine/progress";
import { sentence } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import type { Program, RequiredItem } from "@/lib/programs/types";

interface Standing {
  program: Program;
  progress: ProgramProgress;
}

const requiredText = (items: RequiredItem[]) =>
  items
    .map((item) => (typeof item === "string" ? item : item.oneOf.join(" or ")))
    .join(", ");

/** Rule text can run to a paragraph, which has no place in a one-line summary. */
const brief = (text: string) =>
  text.length > 100 ? `${text.slice(0, 99).trimEnd()}…` : text;

/** What a program's open groups lack, and the rules nobody could read. A prefix marks the minor's. */
function unmet({ progress }: Standing, prefix: string) {
  const open = progress.groups.filter((group) => !group.satisfied);
  return {
    missing: open.flatMap((group) => {
      const what =
        group.kind === "required"
          ? requiredText(group.remaining)
          : lacking(group);
      return what === null
        ? []
        : [`${prefix}${sentence(group.title)}: ${what}`];
    }),
    checks: open.flatMap((group) =>
      group.rules.flatMap((rule) =>
        rule.unparsed ? [`${prefix}${rule.title}`] : [],
      ),
    ),
  };
}

/** One line of what the plan lacks, then one line of rules to check per program. When a line does not fit, Show all opens them all. */
function Missing({
  text,
  checks,
}: {
  text: string;
  checks: { titles: string[]; source: string }[];
}) {
  const lines = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const element = lines.current;
    if (!element) return;
    const measure = () =>
      setClipped(
        [...element.querySelectorAll("[data-line]")].some(
          (line) => line.scrollWidth > line.clientWidth,
        ),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const line = cn("min-w-0", !open && "truncate");
  const showAll = (clipped || open) && (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className="link rounded-md"
    >
      {open ? "Show less" : "Show all"}
    </button>
  );
  return (
    <div
      ref={lines}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"
    >
      {text && (
        <>
          <p className="flex gap-1">
            <span className="shrink-0">Still missing:</span>
            <span data-line className={line}>
              {text}
            </span>
          </p>
          <span>{showAll}</span>
        </>
      )}
      {checks.map(({ titles, source }, i) => (
        <Fragment key={source}>
          <p className="flex items-baseline gap-1">
            <TriangleAlert
              aria-hidden
              className="mr-1 size-4 shrink-0 self-center text-warn"
            />
            <span className="shrink-0">{COPY.checkRequirement}:</span>
            <span data-line className={line}>
              {titles.map(brief).join(" · ")}
            </span>
            <span className="shrink-0">
              · <CatalogueLink href={source} />
            </span>
          </p>
          <span>{!text && i === 0 && showAll}</span>
        </Fragment>
      ))}
    </div>
  );
}

/** The plan's headline: program credits with the plan, what is still missing, the minor, and the warning count. */
export function PlanSummary({
  standing,
  minor,
  warningCount,
  onShowWarnings,
  graduationPassed,
}: {
  standing: Standing | null;
  /** The student's minor, counted on its own from the same courses. */
  minor: Standing | null;
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
  const rows = [
    ...(standing ? [{ ...standing, ...unmet(standing, "") }] : []),
    ...(minor ? [{ ...minor, ...unmet(minor, "Minor: ") }] : []),
  ];
  const missing = rows.flatMap((row) => row.missing).join(" · ");
  const checks = rows.flatMap(({ program, checks }) =>
    checks.length > 0 ? [{ titles: checks, source: program.source }] : [],
  );
  const hasChecks = (program: Program) =>
    rows.some((row) => row.program === program && row.checks.length > 0);
  const met =
    standing !== null && rows.every(({ progress }) => progress.satisfied);

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
        {met ? (
          <p>
            Your plan meets every requirement of{" "}
            {rows
              .map(({ program }, i) =>
                i === 0 ? program.name : COPY.minorTitle(program.name),
              )
              .join(" and ")}
            .
          </p>
        ) : (
          (missing || checks.length > 0) && (
            <Missing
              key={`${missing}|${checks.length}`}
              text={missing}
              checks={checks}
            />
          )
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
    </div>
  );
}
