import { cn } from "cn";
import Link from "next/link";
import { chipStatus, StatusChip } from "@/components/status-chip";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { type CourseState, isOffered } from "@/lib/engine/status";
import type { Season } from "@/lib/profile/types";

const SEASONS: Season[] = ["Fall", "Winter", "Summer"];

export function seasonsOffered(course: CourseSummary): string {
  const seasons = SEASONS.filter((season) => isOffered(course, season));
  return seasons.length > 0 ? seasons.join(", ") : "Not offered this year";
}

const grid = (withStatus: boolean) =>
  cn(
    "grid items-center gap-4 px-4",
    withStatus
      ? "grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_9.5rem_10.5rem]"
      : "grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_9.5rem]",
  );

/** Column labels for a list of CourseRow. Pass the same `withStatus` as the rows. */
export function CourseRowHeader({ withStatus }: { withStatus: boolean }) {
  return (
    <div aria-hidden className="px-0.5 pb-2">
      <div
        className={cn(
          grid(withStatus),
          "font-semibold text-muted-foreground text-xs",
        )}
      >
        <span>Course</span>
        <span>Title</span>
        <span>Credits</span>
        <span>Offered</span>
        {withStatus && <span>Your status</span>}
      </div>
    </div>
  );
}

/** One list item that links to the course page. Pass `state` to show the student's status, and leave it out when there is no profile. */
export function CourseRow({
  course,
  state,
}: {
  course: CourseSummary;
  state?: CourseState;
}) {
  return (
    <li>
      <Link
        href={`/courses/${courseSlug(course.code)}`}
        prefetch={false}
        className={cn(
          grid(Boolean(state)),
          "-outline-offset-3 min-h-14 py-2.5 transition-[background-color] hover:bg-muted/60",
        )}
      >
        <span className="font-extrabold">{course.code}</span>
        <span className="line-clamp-2">{course.title}</span>
        <span className="text-muted-foreground text-sm">
          {course.credits === null ? "-" : `${course.credits} credits`}
        </span>
        <span className="text-muted-foreground text-sm">
          {seasonsOffered(course)}
        </span>
        {state && (
          <StatusChip
            status={chipStatus(state)}
            className="justify-self-start"
          />
        )}
      </Link>
    </li>
  );
}

export function CourseRowSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="divide-y divide-border rounded-lg border-2 border-border bg-card"
    >
      {Array.from({ length: rows }, (_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
        <div key={row} className="flex min-h-14 items-center gap-4 px-4">
          <div className="h-4 w-20 rounded-sm bg-muted motion-safe:animate-pulse" />
          <div className="h-4 flex-1 rounded-sm bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
