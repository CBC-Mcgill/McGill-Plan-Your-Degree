"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { AddToPlan } from "@/components/add-to-plan";
import { chipStatus, StatusChip } from "@/components/status-chip";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus, meets } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SENTENCE = {
  completed: "You have completed this course.",
  "in-progress": "You are taking this course now.",
  available: "You are not missing any prerequisite courses.",
} as const;

/** The student's status for one course, and the way to plan it. Needs only the summary, so the page does not ship the long text twice. */
export function CourseStatusPanel({ course }: { course: CourseSummary }) {
  const snapshot = useSnapshot();
  const plan = useProfileStore((state) => state.plan);

  const state = snapshot ? courseStatus(course, snapshot) : null;
  const plannedTerm = plan.find((entry) =>
    entry.courses.includes(course.code),
  )?.term;
  const missing = snapshot
    ? !meets(course.prerequisites?.tree, snapshot.taken)
    : false;
  const closed =
    state?.status === "completed" || state?.status === "in-progress";

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-lg border-2 border-border bg-card p-6"
    >
      <h2 id="status-heading" className="text-lg">
        Your status
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {snapshot === null && (
          <p className="text-muted-foreground">
            Import your transcript to see whether you can take this course, and
            to add it to a plan.
          </p>
        )}
        {state && (
          <>
            <StatusChip
              status={chipStatus(state)}
              className="h-9 self-start px-3 text-sm"
            />
            <div className="flex flex-col gap-2">
              {state.status === "planned" && plannedTerm && (
                <p>This course is in your plan for {termLabel(plannedTerm)}.</p>
              )}
              {state.status === "locked" && missing && (
                <p>You are missing prerequisite courses.</p>
              )}
              {(state.status === "completed" ||
                state.status === "in-progress" ||
                state.status === "available") && (
                <p>{SENTENCE[state.status]}</p>
              )}
              {state.blockedBy.length > 0 && (
                <p>
                  Not open to students who have taken or are taking{" "}
                  {state.blockedBy.map((code, i) => (
                    <span key={code}>
                      {i > 0 && ", "}
                      <Link
                        href={`/courses/${courseSlug(code)}`}
                        className="font-semibold text-in-progress underline underline-offset-2 hover:text-foreground"
                      >
                        {code}
                      </Link>
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
            {state.uncertain && (
              <div className="flex gap-2.5 rounded-md border border-border bg-muted p-3 text-sm">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  <strong>Check the requirement text.</strong> Some conditions,
                  like permission or standing, cannot be checked here.{" "}
                  <a
                    href="#requirements"
                    className="font-semibold underline underline-offset-2"
                  >
                    Read the requirements
                  </a>{" "}
                  and check them yourself.
                </p>
              </div>
            )}
          </>
        )}
        {!closed && <AddToPlan course={course} />}
      </div>
    </section>
  );
}
