import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status";
import { Card } from "@/components/ui/card";
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
      ? "grid-cols-[6rem_minmax(0,1fr)_5rem_9rem_10rem]"
      : "grid-cols-[6rem_minmax(0,1fr)_5rem_9rem]",
  );

/**
 * One list item that links to the course page. Pass `state` to show the student's status, and leave it out when there is no profile.
 * `note` adds a line under the title. `action` sits beside the link, since a button cannot live inside it: pass null to keep the column empty so rows line up.
 */
export function CourseRow({
  course,
  state,
  note,
  action,
}: {
  course: CourseSummary;
  state?: CourseState;
  note?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li
      className={cn(
        "transition-[background-color] hover:bg-subtle",
        action !== undefined && "flex items-center",
      )}
    >
      <Link
        href={`/courses/${courseSlug(course.code)}`}
        prefetch={false}
        className={cn(
          grid(Boolean(state)),
          "min-h-11 py-2 -outline-offset-3",
          action !== undefined && "min-w-0 flex-1",
        )}
      >
        <span className="font-semibold tabular-nums">{course.code}</span>
        <span>
          <span className="line-clamp-2">{course.title}</span>
          {note}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {course.credits === null
            ? "-"
            : `${course.credits} ${course.credits === 1 ? "credit" : "credits"}`}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {seasonsOffered(course)}
        </span>
        {state && (
          <StatusLabel
            status={state.status}
            uncertain={state.uncertain}
            className="justify-self-start"
          />
        )}
      </Link>
      {action !== undefined && (
        <div className="flex w-48 shrink-0 justify-end pr-4">{action}</div>
      )}
    </li>
  );
}

const bone = "rounded-sm bg-muted motion-safe:animate-pulse";

/** The browse card before the catalogue arrives: tabs, toolbar, table header and rows at their final heights. */
export function BrowseSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <p role="status" className="sr-only">
        Loading courses
      </p>
      <div aria-hidden>
        <div className="flex h-12 items-center gap-1 border-border border-b px-3">
          {["w-20", "w-36", "w-32", "w-24", "w-28"].map((width) => (
            <div key={width} className="px-3">
              <div className={cn(bone, "h-4", width)} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
          <div className={cn(bone, "h-8 w-[280px] rounded-md")} />
          {["w-24", "w-20", "w-20"].map((width, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            <div key={i} className={cn(bone, "h-8 rounded-md", width)} />
          ))}
          <div className={cn(bone, "ml-auto h-8 w-40 rounded-md")} />
        </div>
        <div className="h-9 border-border border-b bg-subtle" />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }, (_, row) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              key={row}
              className="flex h-10 items-center gap-6 px-4"
            >
              <div className={cn(bone, "h-4 w-24")} />
              <div className={cn(bone, "h-4 w-1/3")} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
