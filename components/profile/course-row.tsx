import { TriangleAlert, X } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { formatTerm } from "@/lib/profile/terms";
import type { CourseStatus, Term } from "@/lib/profile/types";

interface Row {
  code: string;
  title: string | null;
  credits: number | null;
  grade: string | null;
  status: CourseStatus;
}

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
    <li className="flex items-center gap-4 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{code}</span>
        {title && (
          <span
            title={title}
            className="block truncate text-muted-foreground text-sm"
          >
            {title}
          </span>
        )}
        {missing && (
          <span className="mt-0.5 flex items-center gap-1 font-semibold text-available text-xs">
            <TriangleAlert
              aria-hidden
              className="size-3.5"
              strokeWidth={2.75}
            />
            Not in the catalogue
          </span>
        )}
      </span>
      <span className="w-12 text-right text-muted-foreground text-sm tabular-nums">
        {credits !== null && (
          <>
            {credits}
            <span aria-hidden> cr</span>
            <span className="sr-only"> credits</span>
          </>
        )}
      </span>
      <span className="w-9 text-center font-bold">
        {grade && (
          <>
            <span className="sr-only">Grade </span>
            {grade}
          </>
        )}
      </span>
      <span className="flex w-32 justify-start">
        <StatusChip status={status} />
      </span>
      <button
        type="button"
        aria-label={`Remove ${code}`}
        onClick={onRemove}
        className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X aria-hidden className="size-5" />
      </button>
    </li>
  );
}

/** A term heading over a list of CourseRows. */
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
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-lg">
          {term ? formatTerm(term) : "Credits before your first term"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {count} {count === 1 ? "course" : "courses"}
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-md border-2 border-border bg-card">
        {children}
      </ul>
    </section>
  );
}
