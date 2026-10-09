import { TriangleAlert, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { STATUS, StatusIcon, StatusTip } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatTerm } from "@/lib/profile/terms";
import type { CourseStatus, Term } from "@/lib/profile/types";

/**
 * One record of the profile or the review, 44px like every row: glyph, code, title, meta, credits, grade, then × on hover and focus (pattern A).
 * The word "Completed" shows only without a grade (D41), since the glyph and the grade already say it.
 */
export function CourseRow({
  code,
  title,
  credits,
  grade,
  status,
  note,
  missing = false,
  onRemove,
}: {
  code: string;
  title: string | null;
  credits: number | null;
  grade: string | null;
  status: CourseStatus;
  /** Such as when a part's credit arrives. */
  note?: string;
  missing?: boolean;
  onRemove: () => void;
}) {
  const word = STATUS[status].label;
  const showWord = !(status === "completed" && grade);
  const meta = [
    showWord && word,
    note,
    missing && (
      <span className="inline-flex items-center gap-2">
        <TriangleAlert aria-hidden className="size-3.5 text-warn" />
        Not in the catalogue
      </span>
    ),
  ].filter(Boolean);
  return (
    <li className="group -mx-2 flex min-h-11 items-start gap-4 rounded-md px-2 py-3 focus-within:bg-tint hover:bg-tint">
      {showWord ? (
        <span className="flex h-5 w-4 shrink-0 items-center">
          <StatusIcon status={status} />
        </span>
      ) : (
        <StatusTip
          status={status}
          className="flex h-5 w-4 shrink-0 items-center"
        >
          <StatusIcon status={status} label={word} />
        </StatusTip>
      )}
      <span className="w-24 shrink-0 font-semibold tabular-nums">{code}</span>
      <span className="min-w-0 flex-1 truncate" title={title ?? undefined}>
        {title}
      </span>
      {meta.length > 0 && (
        <span className="max-w-80 flex-none text-fg-muted">
          {meta.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: at most three fixed items
            <Fragment key={i}>
              {i > 0 && " · "}
              {item}
            </Fragment>
          ))}
        </span>
      )}
      <span className="w-12 shrink-0 text-right text-fg-muted tabular-nums">
        {credits !== null && (
          <>
            {credits}
            <span aria-hidden> cr</span>
            <span className="sr-only"> credits</span>
          </>
        )}
      </span>
      <span className="w-8 shrink-0 font-semibold">
        {grade && (
          <>
            <span className="sr-only">Grade </span>
            {grade}
          </>
        )}
      </span>
      <span className="-my-2 flex shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="text"
          icon
          aria-label={`Remove ${code}`}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      </span>
    </li>
  );
}

/** An h3 term name over its rows, 24px above every group but the first. */
export function TermGroup({
  term,
  children,
}: {
  term: Term | null;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2">
        {term ? formatTerm(term) : "Credits before your first term"}
      </h3>
      <ul>{children}</ul>
    </section>
  );
}
