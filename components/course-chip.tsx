"use client";

import Link from "next/link";
import { STATUS, type Status, StatusIcon } from "@/components/status";
import { courseSlug } from "@/lib/catalogue/slug";
import { courseStatus, type StatusInput } from "@/lib/engine/status";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const TAKEN: readonly Status[] = ["completed", "covered", "in-progress"];

/** A course code that links to its page, with the student's status for it when known. */
export function CourseChip({
  code,
  label = code,
  status,
}: {
  code: string;
  label?: string;
  status?: Status | null;
}) {
  return (
    <Link
      href={`/courses/${courseSlug(code)}`}
      prefetch={false}
      className="whitespace-nowrap rounded-sm bg-subtle px-1.5 py-0.5 font-semibold text-[13px] shadow-[inset_0_0_0_1px_var(--border)] hover:bg-muted"
    >
      {status && (
        <StatusIcon
          status={status}
          size={12}
          label={STATUS[status].label}
          className="mr-1 inline align-[-1px]"
        />
      )}
      {label}
    </Link>
  );
}

/** A chip that reads the student's status for the course itself. With `onlyTaken` it marks only courses already taken, for lists where "can take" would mislead. */
export function LiveCourseChip({
  course,
  label,
  onlyTaken = false,
}: {
  course: StatusInput;
  label?: string;
  onlyTaken?: boolean;
}) {
  const snapshot = useSnapshot();
  const status = snapshot ? courseStatus(course, snapshot).status : null;
  return (
    <CourseChip
      code={course.code}
      label={label}
      status={onlyTaken && status && !TAKEN.includes(status) ? null : status}
    />
  );
}
