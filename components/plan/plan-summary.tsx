import { Check, GraduationCap, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { GroupProgress, ProgramProgress } from "@/lib/engine/progress";
import type { Program, RequiredItem } from "@/lib/programs/types";

const MAX_ITEMS = 3;

const linkClass = "font-medium underline underline-offset-2 hover:text-primary";

function requiredText(items: RequiredItem[]): string {
  const shown = items
    .slice(0, MAX_ITEMS)
    .map((item) => (typeof item === "string" ? item : item.oneOf.join(" or ")));
  const more = items.length - shown.length;
  return `${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

/** What a complementary group lacks: credits first, then the first rule it fails. */
function lacking(group: GroupProgress): string {
  if (group.creditsDone < group.credits) {
    return `${group.creditsDone} of ${group.credits} credits`;
  }
  const open = group.rules.filter((rule) => !rule.satisfied);
  const [rule] = open;
  if (!rule) return `${group.coursesDone} of ${group.minCourses} courses`;
  const need =
    rule.minCredits === undefined
      ? `${rule.coursesDone} of ${rule.minCourses} courses`
      : `${rule.creditsDone} of ${rule.minCredits} credits`;
  return `${rule.title} (${need})${open.length > 1 ? ` and ${open.length - 1} more` : ""}`;
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
        `${group.title}: ${group.kind === "required" ? requiredText(group.remaining) : lacking(group)}`,
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
                <p
                  className="truncate text-[13px] text-muted-foreground leading-[18px]"
                  title={missing}
                >
                  {progress.satisfied ? (
                    <span className="font-medium text-completed">
                      Your plan satisfies {program.name}.
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        Still missing
                      </span>{" "}
                      {missing}
                    </>
                  )}
                </p>
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
            <div>
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
