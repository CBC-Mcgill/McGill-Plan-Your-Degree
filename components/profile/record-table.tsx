import { cn } from "cn";
import { ArrowDown, TriangleAlert, X } from "lucide-react";
import { CourseCode } from "@/components/course-code";
import {
  STATUS,
  StatusBadge,
  StatusIcon,
  StatusTip,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatTerm } from "@/lib/profile/terms";
import {
  COURSE_STATUSES,
  type CourseStatus,
  type Term,
  termKey,
} from "@/lib/profile/types";

/** One course record of the profile or the transcript review. */
export interface RecordRow {
  key: string;
  /** With the part, such as ECSE 458D1. */
  code: string;
  title: string | null;
  term: Term | null;
  credits: number | null;
  grade: string | null;
  status: CourseStatus;
  /** Such as when a part's credit arrives. */
  note?: string;
  missing?: boolean;
  onRemove: () => void;
}

/** Like Browse: a hairline above each 44px row, and the row's hover and focus tint across the card. */
const CELL =
  "whitespace-nowrap border-line border-t py-3 pr-4 first:pl-5 last:pr-5 group-focus-within:bg-tint group-hover:bg-tint";
const HEAD = "whitespace-nowrap pr-4 font-normal first:pl-5 last:pr-5";

const sortKey = (row: RecordRow) => (row.term ? termKey(row.term) : -1);

function Dash({ label }: { label: string }) {
  return (
    <span className="text-fg-muted">
      <span aria-hidden>–</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "11 completed, 4 in progress, 1 withdrawn", each in its status color, so the record's make-up reads before any row. */
export function StatusCounts({
  statuses,
}: {
  statuses: readonly CourseStatus[];
}) {
  const counts = COURSE_STATUSES.map(
    (status) => [status, statuses.filter((s) => s === status).length] as const,
  ).filter(([, n]) => n > 0);
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 tabular-nums">
      {counts.map(([status, n]) => (
        <span key={status} className="inline-flex items-center gap-2">
          <StatusIcon status={status} />
          <span style={{ color: STATUS[status].text }}>
            {n} {STATUS[status].label.toLowerCase()}
            {(status === "transfer" || status === "exemption") && n > 1 && "s"}
          </span>
        </span>
      ))}
    </p>
  );
}

/** The course record as a Browse-style table, newest term first. It bleeds to the edges of the card it sits in, and × on row hover and focus removes a record. */
export function RecordTable({ rows }: { rows: RecordRow[] }) {
  return (
    <table className="-mx-5 w-[calc(100%+2.5rem)] border-separate border-spacing-0">
      <caption className="sr-only">Your courses, newest term first</caption>
      <thead>
        <tr className="h-9 text-left text-fg-muted">
          <th className={HEAD}>Course</th>
          <th className={cn(HEAD, "w-full")}>
            <span className="sr-only">Title</span>
          </th>
          <th className={HEAD} aria-sort="descending">
            <span className="inline-flex items-center gap-1">
              Term
              <ArrowDown aria-hidden className="size-3.5" />
            </span>
          </th>
          <th className={HEAD}>Status</th>
          <th className={cn(HEAD, "text-right")}>Credits</th>
          <th className={HEAD}>Grade</th>
          <th className={HEAD}>
            <span className="sr-only">Remove</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {[...rows]
          .sort((a, b) => sortKey(b) - sortKey(a))
          .map((row) => (
            <tr key={row.key} className="group h-11">
              <td className={cn(CELL, "font-semibold tabular-nums")}>
                <CourseCode code={row.code} />
              </td>
              <td className={cn(CELL, "max-w-0")}>
                {row.title && (
                  <span className="block truncate" title={row.title}>
                    {row.title}
                  </span>
                )}
                {row.missing && (
                  <span className="flex items-center gap-2 text-fg-muted">
                    <TriangleAlert
                      aria-hidden
                      className="size-3.5 shrink-0 text-warn"
                    />
                    Not in the catalogue
                  </span>
                )}
                {row.note && (
                  <span className="block truncate text-fg-muted">
                    {row.note}
                  </span>
                )}
              </td>
              <td className={CELL}>
                {row.term ? (
                  formatTerm(row.term)
                ) : (
                  <span className="text-fg-muted">Before your first term</span>
                )}
              </td>
              <td className={CELL}>
                <StatusTip status={row.status} className="flex w-fit">
                  <StatusBadge status={row.status} />
                </StatusTip>
              </td>
              <td className={cn(CELL, "text-right tabular-nums")}>
                {row.credits ?? <Dash label="No credits" />}
              </td>
              <td className={cn(CELL, "font-semibold")}>
                {row.grade ?? <Dash label="No grade" />}
              </td>
              <td className={CELL}>
                <span className="-my-2 flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    icon
                    aria-label={`Remove ${row.code}`}
                    onClick={row.onRemove}
                  >
                    <X aria-hidden />
                  </Button>
                </span>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
