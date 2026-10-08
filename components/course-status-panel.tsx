"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { AddToPlan } from "@/components/add-to-plan";
import { StatusBadge, UncertainFlag } from "@/components/status";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus, meets } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SENTENCE = {
  completed: "You have completed this course.",
  covered:
    "Your Science DEC covers this course, so you do not need to take it.",
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
    state?.status === "completed" ||
    state?.status === "covered" ||
    state?.status === "in-progress";

  return (
    <Card asChild className="p-5">
      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-base">
          Your status
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {snapshot === null && (
            <p className="text-muted-foreground">
              Import your transcript to see whether you can take this course,
              and to add it to a plan.
            </p>
          )}
          {state && (
            <>
              <div className="flex items-center gap-3">
                <StatusBadge status={state.status} />
                {state.uncertain && <UncertainFlag withLabel />}
              </div>
              <div className="flex flex-col gap-2">
                {state.status === "planned" && plannedTerm && (
                  <p>
                    This course is in your plan for {termLabel(plannedTerm)}.
                  </p>
                )}
                {state.status === "locked" && missing && (
                  <p>You are missing prerequisite courses.</p>
                )}
                {(state.status === "completed" ||
                  state.status === "covered" ||
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
                <Banner>
                  <Info aria-hidden />
                  <p>
                    <strong>Check the requirement text.</strong> Some
                    conditions, like permission or standing, cannot be checked
                    here.{" "}
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
          {!closed && <AddToPlan course={course} />}
        </div>
      </section>
    </Card>
  );
}
