"use client";

import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { CourseCode } from "@/components/course-code";
import { ROW, ROW_LINK, ROW_TITLE } from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import {
  STATUS,
  type Status,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { ShowMore } from "@/components/ui/disclosure";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus } from "@/lib/engine/status";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SHOWN = 12;

/** The courses a course unlocks, with the student's status glyph on each. Past 12 the rest open behind "Show N more", unless only 3 or fewer are left. */
export function UnlockRows({ courses }: { courses: CourseSummary[] }) {
  const split = courses.length > SHOWN + 3 ? SHOWN : courses.length;
  const rest = courses.slice(split);
  return (
    <div className="-my-4">
      <Rows courses={courses.slice(0, split)} />
      {rest.length > 0 && (
        <ShowMore count={rest.length}>
          <Rows courses={rest} />
        </ShowMore>
      )}
    </div>
  );
}

function Rows({ courses }: { courses: CourseSummary[] }) {
  const snapshot = useSnapshot();
  return (
    <ul>
      {courses.map((course) => {
        const state = snapshot ? courseStatus(course, snapshot) : null;
        return (
          <CodeRow
            key={course.code}
            code={course.code}
            title={course.title}
            page={course.code}
            glyph={state?.status}
            uncertain={state?.uncertain}
            end={
              <span className="shrink-0 whitespace-nowrap text-fg-muted tabular-nums">
                <CreditsLabel course={course} bare />
              </span>
            }
          />
        );
      })}
    </ul>
  );
}

/**
 * A course page row (44px, grows when the note wraps): the code in its subject color and the title as one link, `note` muted under the title, `end` on the right.
 * `page` is the code of the course page it links to, such as ECON 352 for ECON 352D1, and none when the catalogue has no such course. `glyph` leads with the status glyph, its word on hover.
 */
export function CodeRow({
  code,
  title,
  page,
  glyph,
  note,
  uncertain,
  end,
  className,
}: {
  code: string;
  title: string;
  page?: string;
  glyph?: Status;
  note?: string;
  uncertain?: boolean;
  end?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <span className="w-24 shrink-0 font-semibold tabular-nums">
        <CourseCode code={code} />
      </span>
      <span className="min-w-0">
        <span className="block truncate" title={title}>
          {title}
        </span>
        {note && <span className="block text-fg-muted">{note}</span>}
      </span>
    </>
  );
  const link = page ? (
    <Link
      href={`/courses/${courseSlug(page)}`}
      prefetch={false}
      className={ROW_LINK}
    >
      {body}
    </Link>
  ) : (
    <span className="flex min-w-0 gap-4">{body}</span>
  );
  return (
    <li className={cn(ROW, className)}>
      <span className={ROW_TITLE}>
        {glyph ? (
          <StatusTip status={glyph} className="flex min-w-0 gap-2">
            <span className="flex h-5 w-4 shrink-0 items-center">
              <StatusIcon status={glyph} label={STATUS[glyph].label} />
            </span>
            {link}
          </StatusTip>
        ) : (
          link
        )}
        {uncertain && <UncertainFlag />}
      </span>
      {end}
    </li>
  );
}
