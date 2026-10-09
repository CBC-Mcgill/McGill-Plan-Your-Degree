"use client";

import { Info } from "lucide-react";
import { CourseChip } from "@/components/course-chip";
import { SectionCard } from "@/components/section-card";
import { STATUS, StatusBadge, UncertainFlag } from "@/components/status";
import { Banner } from "@/components/ui/banner";
import { InfoTip } from "@/components/ui/tooltip";
import { codeRuns } from "@/lib/catalogue/codes";
import type { CourseSummary } from "@/lib/catalogue/types";
import {
  courseStatus,
  meets,
  missingText,
  type StatusInput,
} from "@/lib/engine/status";
import { STATUS_TIPS } from "@/lib/glossary";
import { logicalCode } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SENTENCE = {
  completed: "You have completed this course.",
  exempt:
    "You are exempt from this course. It meets prerequisites but earns no credit.",
  covered:
    "Your Science DEC covers this course, so you do not need to take it.",
  "in-progress": "You are taking this course now.",
  available: "You are not missing any prerequisite courses.",
} as const;

/** The student's status for one course. The page's one action sits in the header. `prerequisites` holds the courses its requirement names, for their chips. */
export function CourseStatusPanel({
  course,
  prerequisites,
}: {
  course: CourseSummary;
  prerequisites: Record<string, StatusInput>;
}) {
  const snapshot = useSnapshot();

  const state = snapshot ? courseStatus(course, snapshot) : null;
  const pending = snapshot?.pending.get(course.code);
  const exempt =
    state?.status === "completed" && !snapshot?.earned.has(course.code);
  const shown = exempt ? "exemption" : (state?.status ?? "available");
  const tree = course.prerequisites?.tree;
  const missing =
    snapshot &&
    tree &&
    (state?.status === "locked" || state?.status === "planned") &&
    !meets(tree, snapshot.taken)
      ? missingText(tree, snapshot.taken)
      : null;

  return (
    <SectionCard id="status" title="Your status">
      <div className="flex flex-col gap-3">
        {snapshot === undefined && (
          <div
            aria-hidden
            className="h-7 w-24 rounded-sm bg-muted motion-safe:animate-pulse"
          />
        )}
        {snapshot === null && (
          <p className="text-muted-foreground">
            Import your transcript to see whether you can take this course.
          </p>
        )}
        {snapshot && state && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-center gap-1.5">
                <StatusBadge
                  status={shown}
                  label={exempt ? "Exempt, no credit" : undefined}
                />
                <InfoTip
                  label={exempt ? "Exempt, no credit" : STATUS[shown].label}
                  tip={STATUS_TIPS[shown]}
                />
              </span>
              {state.uncertain && <UncertainFlag withLabel />}
            </div>
            {state.status === "available" && <p>{SENTENCE.available}</p>}
            {(state.status === "completed" ||
              state.status === "covered" ||
              state.status === "in-progress") && (
              <p>
                {pending
                  ? `You have done part of this course. Credit comes when ${course.code}${pending.last} is done.`
                  : SENTENCE[exempt ? "exempt" : state.status]}
              </p>
            )}
            {missing && (
              <div>
                <p>You are missing prerequisite courses:</p>
                <p className="mt-1.5 leading-7">
                  {codeRuns(missing).map(({ at, run, code }) => {
                    const input = code
                      ? prerequisites[logicalCode(run)]
                      : undefined;
                    return input ? (
                      <CourseChip
                        key={at}
                        code={input.code}
                        label={run}
                        status={courseStatus(input, snapshot).status}
                      />
                    ) : (
                      run
                    );
                  })}
                </p>
              </div>
            )}
            {state.blockedBy.length > 0 && (
              <div>
                <p>Not open to students who have taken or are taking:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {state.blockedBy.map((code) => (
                    <CourseChip
                      key={code}
                      code={code}
                      status={
                        snapshot.covered.has(code)
                          ? "covered"
                          : snapshot.done.has(code)
                            ? "completed"
                            : "in-progress"
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {state.uncertain && (
              <Banner>
                <Info aria-hidden />
                <p>
                  <strong>Check the requirement text.</strong> Some conditions,
                  like permission or standing, cannot be checked here.{" "}
                  <a
                    href="#requirements"
                    className="font-medium underline underline-offset-2"
                  >
                    Read the requirements
                  </a>{" "}
                  and check them yourself.
                </p>
              </Banner>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
