import { TriangleAlert, X } from "lucide-react";
import { StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <li className="flex items-center gap-4 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{code}</span>
        {title && (
          <span
            title={title}
            className="block truncate text-[13px] text-muted-foreground"
          >
            {title}
          </span>
        )}
        {missing && (
          <span className="mt-0.5 flex items-center gap-1 font-medium text-warn text-xs">
            <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
            Not in the catalogue
          </span>
        )}
      </span>
      <span className="w-12 text-right text-[13px] text-muted-foreground tabular-nums">
        {credits !== null && (
          <>
            {credits}
            <span aria-hidden> cr</span>
            <span className="sr-only"> credits</span>
          </>
        )}
      </span>
      <span className="w-9 text-center font-semibold">
        {grade && (
          <>
            <span className="sr-only">Grade </span>
            {grade}
          </>
        )}
      </span>
      <span className="flex w-36 justify-start">
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
        <h3 className="text-sm">
          {term ? formatTerm(term) : "Credits before your first term"}
        </h3>
        <p className="text-[13px] text-muted-foreground">
          {count} {count === 1 ? "course" : "courses"}
        </p>
      </div>
      <Card asChild className="divide-y divide-border overflow-hidden">
        <ul>{children}</ul>
      </Card>
    </section>
  );
}
