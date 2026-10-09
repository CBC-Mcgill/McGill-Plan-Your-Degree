"use client";

import Link from "next/link";
import { STATUS, StatusIcon } from "@/components/status";
import { courseSlug } from "@/lib/catalogue/slug";
import type { Snapshot } from "@/lib/engine/snapshot";
import { courseStatus, type StatusInput } from "@/lib/engine/status";
import { useSnapshot } from "@/lib/profile/use-snapshot";

export interface Unlock {
  course: StatusInput;
  title: string;
  /** "3 cr", or "6 cr, 2 terms" for a multi-term course. */
  credits: string;
}

const SHOWN = 12;

/** The courses a course unlocks, as rows with the student's status for each. The rest sit behind "Show more", which works without JavaScript. */
export function UnlockRows({ courses }: { courses: Unlock[] }) {
  const snapshot = useSnapshot();
  return (
    <>
      <Rows courses={courses.slice(0, SHOWN)} snapshot={snapshot} />
      {courses.length > SHOWN && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center border-border border-t px-5 font-medium text-[13px] text-muted-foreground hover:bg-subtle hover:text-foreground group-open:hidden [&::-webkit-details-marker]:hidden">
            Show {courses.length - SHOWN} more
          </summary>
          <Rows courses={courses.slice(SHOWN)} snapshot={snapshot} />
        </details>
      )}
    </>
  );
}

function Rows({
  courses,
  snapshot,
}: {
  courses: Unlock[];
  snapshot: Snapshot | null | undefined;
}) {
  return (
    <ul>
      {courses.map(({ course, title, credits }) => {
        const status = snapshot ? courseStatus(course, snapshot).status : null;
        return (
          <li
            key={course.code}
            className="flex h-11 items-center gap-3 border-border border-t pr-5 pl-5 focus-within:bg-subtle hover:bg-subtle"
          >
            {status && (
              <StatusIcon status={status} label={STATUS[status].label} />
            )}
            <Link
              href={`/courses/${courseSlug(course.code)}`}
              prefetch={false}
              className="-mx-2 flex h-full min-w-0 flex-1 items-center gap-3 rounded-sm px-2 -outline-offset-2"
            >
              <span className="w-[76px] shrink-0 font-semibold tabular-nums">
                {course.code}
              </span>
              <span className="min-w-0 flex-1 truncate" title={title}>
                {title}
              </span>
              <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-muted-foreground tabular-nums">
                {credits}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
