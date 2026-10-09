import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import type { BrowseStatus } from "@/lib/engine/status";
import { GLOSSARY, STATUS_TIPS } from "@/lib/glossary";
import type { CourseStatus as RecordStatus } from "@/lib/profile/types";

/** A course's state for this student, or the outcome a transcript recorded. */
export type Status = BrowseStatus | Exclude<RecordStatus, BrowseStatus>;

/** Words and glyph colors. The glyph shape tells statuses apart, so color stays to --fg, --fg-subtle, --danger and --warn (D9). */
export const STATUS: Record<Status, { label: string; color: string }> = {
  locked: { label: "Locked", color: "var(--fg-subtle)" },
  available: { label: "Can take", color: "var(--fg-subtle)" },
  planned: { label: "Planned", color: "var(--fg)" },
  "in-progress": { label: "In progress", color: "var(--fg)" },
  completed: { label: "Completed", color: "var(--fg)" },
  covered: { label: "Covered", color: "var(--fg)" },
  transfer: { label: "Transfer credit", color: "var(--fg)" },
  exemption: { label: "Exemption", color: "var(--fg)" },
  failed: { label: "Failed", color: "var(--danger)" },
  withdrawn: { label: "Withdrawn", color: "var(--fg-subtle)" },
  deferred: { label: "Deferred", color: "var(--warn)" },
};

const ring = {
  cx: 7,
  cy: 7,
  r: 5.5,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
} as const;

const mark = {
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The status glyph, 14px in rows and 16px on the landing. Decorative by default, so pair it with a word or pass a label. */
export function StatusIcon({
  status,
  size = 14,
  label,
  className,
}: {
  status: Status;
  size?: number;
  label?: string;
  /** @deprecated Wrap the glyph instead. */
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
      style={{ color: STATUS[status].color }}
    >
      {status === "locked" && (
        <>
          <path
            d="M4.75 6.25V4.75a2.25 2.25 0 0 1 4.5 0v1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="3"
            y="6.25"
            width="8"
            height="6"
            rx="1.5"
            fill="currentColor"
          />
        </>
      )}
      {status === "available" && (
        <circle {...ring} strokeDasharray="2.4 1.92" />
      )}
      {status === "planned" && (
        <>
          <circle {...ring} />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </>
      )}
      {status === "in-progress" && (
        <>
          <circle {...ring} />
          <path d="M7 3.25a3.75 3.75 0 0 1 0 7.5z" fill="currentColor" />
        </>
      )}
      {status === "covered" && (
        <>
          <circle {...ring} />
          <path d="m4.4 7.2 1.8 1.8 3.5-3.7" stroke="currentColor" {...mark} />
        </>
      )}
      {(status === "completed" ||
        status === "transfer" ||
        status === "exemption") && (
        <>
          <circle cx="7" cy="7" r="6.25" fill="currentColor" />
          <path d="m4.4 7.2 1.8 1.8 3.5-3.7" stroke="white" {...mark} />
        </>
      )}
      {status === "failed" && (
        <>
          <circle cx="7" cy="7" r="6.25" fill="currentColor" />
          <path d="m4.9 4.9 4.2 4.2m0-4.2-4.2 4.2" stroke="white" {...mark} />
        </>
      )}
      {status === "withdrawn" && (
        <>
          <circle {...ring} />
          <path d="M4.75 7h4.5" stroke="currentColor" {...mark} />
        </>
      )}
      {status === "deferred" && (
        <>
          <circle {...ring} />
          <path d="M5.75 4.9v4.2m2.5-4.2v4.2" stroke="currentColor" {...mark} />
        </>
      )}
    </svg>
  );
}

/** Shows the status word and why on hover and focus. It wraps the glyph, and may wrap the course link beside it so keyboard focus on the link opens it too. `reason` replaces the general definition. */
export function StatusTip({
  status,
  word = STATUS[status].label,
  reason,
  className = "flex shrink-0",
  children,
}: {
  status: Status;
  word?: string;
  reason?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip
      content={
        <>
          <span className="font-semibold">{word}</span>
          <span className="block">{reason ?? STATUS_TIPS[status]}</span>
        </>
      }
    >
      <span className={className}>{children}</span>
    </Tooltip>
  );
}

/** Glyph, 8px, then the word in --fg-muted and the reason after " · ". */
export function StatusLabel({
  status,
  reason,
  uncertain = false,
}: {
  status: Status;
  reason?: string;
  uncertain?: boolean;
}) {
  return (
    <span className="inline-flex items-start gap-2 text-fg-muted">
      <span className="flex h-5 shrink-0 items-center">
        <StatusIcon status={status} />
      </span>
      <span>
        {STATUS[status].label}
        {reason && ` · ${reason}`}
        {uncertain && (
          <span className="ml-2 inline-flex align-top">
            <UncertainFlag />
          </span>
        )}
      </span>
    </span>
  );
}

/** @deprecated Use `StatusLabel`. */
export function StatusBadge({
  status,
  label = STATUS[status].label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-fg-muted", className)}
    >
      <StatusIcon status={status} />
      {label}
    </span>
  );
}

/** "Has conditions": the catalogue lists something we can't check, such as instructor permission. In rows the word is for screen readers only (D21). */
export function UncertainFlag({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <Tooltip content={GLOSSARY.hasConditions.tip}>
      <span className="inline-flex h-5 items-center gap-2 text-warn">
        <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
        <span className={cn(!withLabel && "sr-only")}>
          {COPY.hasConditions}
        </span>
      </span>
    </Tooltip>
  );
}
