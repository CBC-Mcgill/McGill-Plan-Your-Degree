import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { Term, Tooltip } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import type { BrowseStatus } from "@/lib/engine/status";
import { GLOSSARY, STATUS_TIPS } from "@/lib/glossary";
import type { CourseStatus as RecordStatus } from "@/lib/profile/types";

/** A course's state for this student, or the outcome a transcript recorded. */
export type Status = BrowseStatus | Exclude<RecordStatus, BrowseStatus>;

/** Words and colors. Each status has its own hue, so a list reads at a glance, and the glyph shape and word still carry the meaning without color. `text` is the word's color, which meets 4.5:1 where the glyph color only needs 3:1. */
export const STATUS: Record<
  Status,
  { label: string; color: string; text: string }
> = {
  locked: { label: "Locked", color: "var(--locked)", text: "var(--fg-muted)" },
  available: { label: "Can take", color: "var(--fg)", text: "var(--fg)" },
  planned: {
    label: "Planned",
    color: "var(--planned)",
    text: "var(--planned)",
  },
  "in-progress": {
    label: "In progress",
    color: "var(--in-progress)",
    text: "var(--in-progress)",
  },
  completed: {
    label: "Completed",
    color: "var(--completed)",
    text: "var(--completed)",
  },
  covered: {
    label: "Covered",
    color: "var(--completed)",
    text: "var(--completed)",
  },
  transfer: {
    label: "Transfer credit",
    color: "var(--completed)",
    text: "var(--completed)",
  },
  exemption: {
    label: "Exemption",
    color: "var(--completed)",
    text: "var(--completed)",
  },
  failed: { label: "Failed", color: "var(--danger)", text: "var(--danger)" },
  withdrawn: {
    label: "Withdrawn",
    color: "var(--locked)",
    text: "var(--fg-muted)",
  },
  deferred: { label: "Deferred", color: "var(--warn)", text: "var(--warn)" },
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
}: {
  status: Status;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0"
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

/** "Has conditions": the catalogue lists something we can't check, such as instructor permission. A focusable icon with the word for screen readers and the definition on hover and focus (D21), its target padded to 26px without moving the layout. Never put it inside a link or a button. */
export function UncertainFlag() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center text-warn [&>button]:relative [&>button]:after:absolute [&>button]:after:-inset-1.5">
      <Term def={GLOSSARY.hasConditions}>
        <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
        <span className="sr-only">{COPY.hasConditions}</span>
      </Term>
    </span>
  );
}
