"use client";

import { cn } from "cn";
import { Check, GraduationCap, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { GroupProgress, ProgramProgress } from "@/lib/engine/progress";
import { creditsText, sentence } from "@/lib/format";
import type { Program, RequiredItem } from "@/lib/programs/types";

const linkClass = "font-medium underline underline-offset-2 hover:text-primary";

const requiredText = (items: RequiredItem[]) =>
  items
    .map((item) => (typeof item === "string" ? item : item.oneOf.join(" or ")))
    .join(", ");

/** What a complementary group lacks: credits first, then the first rule it fails. */
function lacking(group: GroupProgress): string {
  if (group.creditsDone < group.credits) {
    return `${creditsText(group.credits - group.creditsDone)} to go`;
  }
  const open = group.rules.filter((rule) => !rule.satisfied);
  const [rule] = open;
  if (!rule) return `${group.coursesDone} of ${group.minCourses} courses`;
  const need =
    rule.minCredits === undefined
      ? `${rule.coursesDone} of ${rule.minCourses} courses`
      : `${creditsText(rule.minCredits - rule.creditsDone)} to go`;
  return `${rule.title} (${need})${open.length > 1 ? ` and ${open.length - 1} more` : ""}`;
}

/** One line of what the plan lacks. When the line does not fit, Show all opens the rest. */
function Missing({ text }: { text: string }) {
  const line = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const element = line.current;
    if (!element) return;
    const measure = () => setClipped(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex items-baseline gap-3 text-[13px] leading-[18px]">
      <p
        ref={line}
        className={cn(
          "min-w-0 flex-1 text-muted-foreground",
          !open && "truncate",
        )}
      >
        <span className="font-medium text-foreground">Still missing</span>{" "}
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`${linkClass} shrink-0 rounded-sm`}
        >
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

/** The slim strip on top: what the plan covers of the program, what is missing, when you graduate and how many warnings it has. */
export function PlanSummary({
  program,
  progress,
  warningCount,
  onShowWarnings,
  graduation,
  graduationSet,
  graduationPassed,
}: {
  program: Program | null;
  progress: ProgramProgress | null;
  warningCount: number;
  onShowWarnings: () => void;
  /** The graduation term's label, or four years from the start when none is set. */
  graduation: string;
  graduationSet: boolean;
  /** The graduation term's label when it is already in the past. */
  graduationPassed: string | null;
}) {
  const missing = (progress?.groups ?? [])
    .filter((group) => !group.satisfied)
    .map(
      (group) =>
        `${sentence(group.title)}: ${group.kind === "required" ? requiredText(group.remaining) : lacking(group)}`,
    )
    .join(" · ");
  return (
    <>
      <Card asChild className="flex items-stretch gap-6 px-5 py-4">
        <section aria-label="Plan summary">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            {program && progress ? (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-base leading-6">
                    Your plan covers{" "}
                    <span className="tabular-nums">
                      {progress.creditsDone} of {progress.credits} credits
                    </span>
                  </h2>
                  <span
                    className="truncate text-[13px] text-muted-foreground"
                    title={program.name}
                  >
                    {program.name}
                  </span>
                </div>
                <ProgressBar
                  value={progress.creditsDone}
                  max={progress.credits}
                  label={`Credits of ${program.name} your plan covers`}
                  valueText={`${progress.creditsDone} of ${progress.credits} credits`}
                />
                {progress.satisfied ? (
                  <p className="font-medium text-[13px] text-completed leading-[18px]">
                    Your plan satisfies {program.name}.
                  </p>
                ) : (
                  <Missing key={missing} text={missing} />
                )}
              </>
            ) : (
              <>
                <h2 className="text-base leading-6">Choose your program</h2>
                <p className="text-[13px] text-muted-foreground leading-[18px]">
                  <Link href="/profile" className={linkClass}>
                    Pick your program on your profile
                  </Link>{" "}
                  to see what your plan still needs to graduate.
                </p>
              </>
            )}
          </div>
          <div className="w-px bg-border" />
          <dl className="flex shrink-0 items-center gap-8">
            <div className="w-32">
              <dt className="text-muted-foreground text-xs leading-4">
                Graduation
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold leading-5">
                <GraduationCap
                  aria-hidden
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.75}
                />
                {graduation}
              </dd>
            </div>
            <div className="w-36">
              <dt className="text-muted-foreground text-xs leading-4">
                Warnings
              </dt>
              <dd className="mt-1 flex h-5 items-center gap-2">
                {warningCount === 0 ? (
                  <span className="flex items-center gap-1.5 font-semibold text-completed">
                    <Check aria-hidden className="size-4" strokeWidth={2} />
                    None
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 font-semibold text-[color-mix(in_oklab,var(--warn)_85%,black)]">
                      <TriangleAlert
                        aria-hidden
                        className="size-4"
                        strokeWidth={2}
                      />
                      {warningCount === 1
                        ? "1 warning"
                        : `${warningCount} warnings`}
                    </span>
                    <button
                      type="button"
                      onClick={onShowWarnings}
                      title="Show the first term with a warning"
                      className={`${linkClass} rounded-sm text-[13px]`}
                    >
                      Show
                    </button>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </section>
      </Card>

      {graduationPassed && (
        <Banner>
          <Info aria-hidden />
          <span>
            Your expected graduation, {graduationPassed}, has already passed, so
            there are no terms left to plan.{" "}
            <Link href="/profile" className={linkClass}>
              Update it on your profile
            </Link>
            .
          </span>
        </Banner>
      )}

      {!graduationSet && (
        <Banner>
          <Info aria-hidden />
          <span>
            You have not set your graduation term, so the path shows four years
            from your start.{" "}
            <Link href="/profile" className={linkClass}>
              Set it on your profile
            </Link>
            .
          </span>
        </Banner>
      )}
    </>
  );
}
