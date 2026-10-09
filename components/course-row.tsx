import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { CreditsLabel } from "@/components/credits-label";
import {
  STATUS,
  type Status,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { isOffered } from "@/lib/engine/status";
import type { Season } from "@/lib/profile/types";

const SEASONS: Season[] = ["Fall", "Winter", "Summer"];

export function seasonsOffered(course: CourseSummary): string {
  const seasons = SEASONS.filter((season) => isOffered(course, season));
  return seasons.length > 0 ? seasons.join(", ") : COPY.notOfferedYear;
}

/**
 * The one course row (44px, grows when the reason wraps): glyph, code, title, reason or meta, credits, action.
 * Code and title link to the course page, and `uncertain` puts the "Has conditions" icon right after the title. The glyph shows only with `showGlyph` (D10), and its tooltip gives the word and `reason`, or `tip`, a reason for the tooltip alone.
 * `reason` and then `meta` sit in one muted column up to 320px wide. `note` is a muted line under the title.
 * `action` appears on row hover and focus (pattern A). Pass `action={null}` to keep its column so rows line up.
 */
export function CourseRow({
  course,
  status,
  showGlyph = false,
  uncertain = false,
  reason,
  tip,
  note,
  meta,
  action,
}: {
  course: CourseSummary;
  status?: Status;
  showGlyph?: boolean;
  uncertain?: boolean;
  reason?: string;
  tip?: string;
  note?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  const link = (
    <Link
      href={`/courses/${courseSlug(course.code)}`}
      prefetch={false}
      className={ROW_LINK}
    >
      <span className="w-24 shrink-0 font-semibold tabular-nums">
        {course.code}
      </span>
      <span className="min-w-0">
        <span className="block truncate" title={course.title}>
          {course.title}
        </span>
        {note && <span className="block text-fg-muted">{note}</span>}
      </span>
    </Link>
  );
  return (
    <li className={ROW}>
      <span className={ROW_TITLE}>
        {showGlyph && status ? (
          <StatusTip
            status={status}
            reason={reason ?? tip}
            className="flex min-w-0 gap-2"
          >
            <span className="flex h-5 w-4 shrink-0 items-center">
              <StatusIcon status={status} label={STATUS[status].label} />
            </span>
            {link}
          </StatusTip>
        ) : (
          link
        )}
        {uncertain && <UncertainFlag />}
      </span>
      {(reason || meta) && (
        <span className="flex max-w-80 flex-none items-start gap-2 text-fg-muted">
          {reason && <span>{reason}</span>}
          {meta}
        </span>
      )}
      <span className="w-24 shrink-0 whitespace-nowrap text-right text-fg-muted tabular-nums">
        <CreditsLabel course={course} />
      </span>
      {action !== undefined && (
        <span className="-my-2 flex w-24 shrink-0 justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          {action}
        </span>
      )}
    </li>
  );
}

/** A course row's box: 44px, the hover and focus tint bleeding 8px past the text. */
export const ROW =
  "group -mx-2 flex min-h-11 items-start gap-4 rounded-md px-2 py-3 focus-within:bg-tint hover:bg-tint";
/** The glyph, code and title column. The link ends at the title so the "Has conditions" icon can follow it, and its ::after, under the text, keeps the whole column clickable. */
export const ROW_TITLE =
  "relative isolate flex min-w-0 flex-1 items-start gap-2";
export const ROW_LINK =
  "-my-3 flex min-w-0 gap-4 rounded-md py-3 after:absolute after:inset-x-0 after:-inset-y-3 after:-z-10 focus-visible:-outline-offset-2";

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

/** The course table before the catalogue arrives: views, filters and rows at their final heights. */
export function BrowseSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading courses
      </p>
      <div aria-hidden>
        <div className="flex h-9 items-center gap-1">
          {["w-28", "w-28", "w-12"].map((width, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            <div key={i} className={cn(bone, "h-9", width)} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className={cn(bone, "h-9 w-80")} />
          {["w-24", "w-20", "w-20", "w-24"].map((width, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            <div key={i} className={cn(bone, "h-9", width)} />
          ))}
        </div>
        <div className="mt-6">
          {Array.from({ length: rows }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            <div key={row} className="flex h-11 items-center gap-4">
              <div className={cn(bone, "h-5 w-24")} />
              <div className={cn(bone, "h-5 w-1/3")} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
