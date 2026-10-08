import { TriangleAlert, X } from "lucide-react";
import { StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatTerm } from "@/lib/profile/terms";
import type { CourseStatus, Term } from "@/lib/profile/types";

interface Row {
  code: string;
  title: string | null;
  credits: number | null;
  grade: string | null;
  status: CourseStatus;
}

/** One course of a term, 44px tall like the rows on What's next. */
export function CourseRow({
  code,
  title,
  credits,
  grade,
  status,
  missing = false,
  onRemove,
}: Row & { missing?: boolean; onRemove: () => void }) {
  return (
    <li className="flex h-11 items-center gap-4 border-border border-t pr-3 pl-5">
      <span className="w-[76px] shrink-0 font-semibold tabular-nums">
        {code}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {title && (
          <span title={title} className="truncate">
            {title}
          </span>
        )}
        {missing && (
          <span className="flex shrink-0 items-center gap-1 font-medium text-warn text-xs">
            <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
            Not in the catalogue
          </span>
        )}
      </span>
      <span className="w-12 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums">
        {credits !== null && (
          <>
            {credits}
            <span aria-hidden> cr</span>
            <span className="sr-only"> credits</span>
          </>
        )}
      </span>
      <span className="w-9 shrink-0 text-center font-semibold">
        {grade && (
          <>
            <span className="sr-only">Grade </span>
            {grade}
          </>
        )}
      </span>
      <span className="flex w-32 shrink-0">
        <StatusLabel status={status} />
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${code}`}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

/** A term heading band over a list of CourseRows. Put it inside a Card, which clips the band to its corners. */
export function TermGroup({
  term,
  count,
  children,
}: {
  term: Term | null;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-t first:border-t-0">
      <div className="flex h-9 items-center justify-between gap-4 bg-subtle px-5">
        <h3 className="text-[13px] leading-[18px]">
          {term ? formatTerm(term) : "Credits before your first term"}
        </h3>
        <p className="text-[13px] text-muted-foreground">
          {count} {count === 1 ? "course" : "courses"}
        </p>
      </div>
      <ul>{children}</ul>
    </section>
  );
}
