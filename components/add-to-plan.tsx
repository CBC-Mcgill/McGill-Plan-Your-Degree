"use client";

import { FileUp, Plus, X } from "lucide-react";
import Link from "next/link";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { StatusIcon } from "@/components/status";
import { Button } from "@/components/ui/button";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseLoads, loadsTerms } from "@/lib/engine/plan";
import { courseStatus, isOffered } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

/** The page's one primary action: plan the course for the next term it runs, or take it back out. Courses the student has taken, is taking, or that do not run this year have none. */
export function AddToPlan({ course }: { course: CourseSummary }) {
  const snapshot = useSnapshot();
  const plan = useProfileStore((state) => state.plan);

  if (snapshot === undefined) return null;
  if (snapshot === null) {
    return (
      <Button asChild size="lg">
        <Link href="/profile">
          <FileUp aria-hidden />
          Import your transcript
        </Link>
      </Button>
    );
  }
  const { status, blockedBy } = courseStatus(course, snapshot);
  if (
    status === "completed" ||
    status === "covered" ||
    status === "in-progress"
  )
    return null;

  const planned = plan.find((entry) =>
    entry.courses.includes(course.code),
  )?.term;
  const next = planTermOptions([]).find((term) =>
    isOffered(course, term.season),
  );
  const terms = (start: Term) =>
    loadsTerms(courseLoads(course.code, course, start));

  const locked = status === "locked";
  const reason =
    blockedBy.length > 0
      ? "Blocked by a course you took"
      : "Missing prerequisites";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        {planned && (
          <span className="inline-flex items-center gap-1.5 font-medium text-planned">
            <StatusIcon status="planned" />
            Planned for {terms(planned)}
          </span>
        )}
        {planned ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => removeWithUndo(planned, course.code)}
          >
            <X aria-hidden />
            Remove
            <span className="sr-only"> from {terms(planned)}</span>
          </Button>
        ) : next ? (
          <Button size="lg" onClick={() => addWithUndo(next, course.code)}>
            <Plus aria-hidden />
            Add to {terms(next)}
            {locked && " anyway"}
          </Button>
        ) : (
          <span className="text-muted-foreground">Not offered this year</span>
        )}
      </div>
      {locked && next && (
        <p className="text-[13px] text-muted-foreground leading-[18px]">
          {reason}
        </p>
      )}
    </div>
  );
}
