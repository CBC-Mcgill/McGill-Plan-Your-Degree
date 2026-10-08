import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { CourseLink } from "@/components/course-link";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { GroupProgress, ProgramProgress } from "@/lib/engine/progress";
import type { Program, RequiredItem } from "@/lib/programs/types";

const MAX_GROUPS = 3;
const MAX_ITEMS = 3;

const linkClass = "font-medium underline underline-offset-2 hover:text-primary";

function Items({ items }: { items: RequiredItem[] }) {
  const shown = items.slice(0, MAX_ITEMS);
  const more = items.length - shown.length;
  return (
    <>
      {shown.map((item, i) => {
        const codes = typeof item === "string" ? [item] : item.oneOf;
        return (
          <Fragment key={codes.join()}>
            {i > 0 && ", "}
            {codes.map((code, j) => (
              <Fragment key={code}>
                {j > 0 && " or "}
                <CourseLink code={code} />
              </Fragment>
            ))}
          </Fragment>
        );
      })}
      {more > 0 && ` and ${more} more`}
    </>
  );
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

function Missing({ group }: { group: GroupProgress }) {
  return (
    <li>
      <span className="font-semibold">{group.title}:</span>{" "}
      {group.kind === "required" ? (
        <Items items={group.remaining} />
      ) : (
        lacking(group)
      )}
    </li>
  );
}

/** What the whole plan covers of the program, what is missing, and how many warnings it has. */
export function PlanSummary({
  program,
  progress,
  warningCount,
  onShowWarnings,
  graduationSet,
  graduationPassed,
}: {
  program: Program | null;
  progress: ProgramProgress | null;
  warningCount: number;
  onShowWarnings: () => void;
  graduationSet: boolean;
  /** The graduation term's label when it is already in the past. */
  graduationPassed: string | null;
}) {
  const missing = progress?.groups.filter((group) => !group.satisfied) ?? [];
  return (
    <Card
      asChild
      className="grid grid-cols-[minmax(0,1fr)_14rem] gap-x-8 gap-y-4 p-5"
    >
      <section aria-label="Plan summary">
        <div className="flex flex-col gap-3">
          {program && progress ? (
            <>
              <h2 className="text-base">
                Your plan covers {progress.creditsDone} of {progress.credits}{" "}
                credits
              </h2>
              <ProgressBar
                value={progress.creditsDone}
                max={progress.credits}
                fill="planned"
                label={`Credits of ${program.name} your plan covers`}
                valueText={`${progress.creditsDone} of ${progress.credits} credits`}
                className="h-2"
              />
            </>
          ) : (
            <>
              <h2 className="text-base">Choose your program</h2>
              <p>
                <Link href="/profile" className={linkClass}>
                  Pick your program on your profile
                </Link>{" "}
                to see what your plan still needs to graduate.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col justify-center gap-1 border-border border-l pl-8">
          {warningCount === 0 ? (
            <p className="flex items-center gap-2 font-semibold text-completed">
              <CircleCheck aria-hidden className="size-4" />
              No warnings
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold text-warn">
                <TriangleAlert aria-hidden className="size-4" />
                {warningCount === 1 ? "1 warning" : `${warningCount} warnings`}
              </p>
              <button
                type="button"
                onClick={onShowWarnings}
                className={`${linkClass} self-start rounded-sm text-[13px]`}
              >
                Show me
              </button>
            </>
          )}
        </div>

        {program && progress && (
          <div className="col-span-2">
            {progress.satisfied ? (
              <p className="flex items-center gap-2 font-semibold text-completed">
                <CircleCheck aria-hidden className="size-4" />
                Your plan satisfies {program.name}.
              </p>
            ) : (
              <>
                <h3 className="text-sm">Still missing</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {missing.slice(0, MAX_GROUPS).map((group) => (
                    <Missing key={group.title} group={group} />
                  ))}
                </ul>
                {missing.length > MAX_GROUPS && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    and {missing.length - MAX_GROUPS} more{" "}
                    {missing.length - MAX_GROUPS === 1 ? "group" : "groups"}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {graduationPassed && (
          <Banner className="col-span-2">
            <Info aria-hidden />
            <span>
              Your expected graduation, {graduationPassed}, has already passed,
              so there are no terms left to plan.{" "}
              <Link href="/profile" className={linkClass}>
                Update it on your profile
              </Link>
              .
            </span>
          </Banner>
        )}

        {!graduationSet && (
          <Banner className="col-span-2">
            <Info aria-hidden />
            <span>
              You have not set your graduation term, so the path shows four
              years from your start.{" "}
              <Link href="/profile" className={linkClass}>
                Set it on your profile
              </Link>
              .
            </span>
          </Banner>
        )}
      </section>
    </Card>
  );
}
