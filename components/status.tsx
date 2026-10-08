import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { BrowseStatus } from "@/lib/engine/status";
import type { CourseStatus as RecordStatus } from "@/lib/profile/types";

/** A course's state for this student, or the outcome a transcript recorded. */
export type Status = BrowseStatus | Exclude<RecordStatus, BrowseStatus>;

type Tone = React.ComponentProps<typeof Badge>["tone"];

/** Words, colors and badge tones for the status system. Glyphs grow with commitment, from a lock to a filled check. */
export const STATUS: Record<
  Status,
  { label: string; color: string; text: string; tone: Tone }
> = {
  locked: {
    label: "Locked",
    color: "var(--locked)",
    text: "text-muted-foreground",
    tone: "neutral",
  },
  available: {
    label: "Can take",
    color: "var(--available)",
    text: "text-muted-foreground",
    tone: "neutral",
  },
  planned: {
    label: "Planned",
    color: "var(--planned)",
    text: "text-planned",
    tone: "planned",
  },
  "in-progress": {
    label: "In progress",
    color: "var(--in-progress)",
    text: "text-in-progress",
    tone: "in-progress",
  },
  completed: {
    label: "Completed",
    color: "var(--completed)",
    text: "text-completed",
    tone: "completed",
  },
  covered: {
    label: "Covered",
    color: "var(--covered)",
    text: "text-covered",
    tone: "completed",
  },
  transfer: {
    label: "Transfer credit",
    color: "var(--completed)",
    text: "text-completed",
    tone: "completed",
  },
  exemption: {
    label: "Exemption",
    color: "var(--completed)",
    text: "text-completed",
    tone: "completed",
  },
  failed: {
    label: "Failed",
    color: "var(--failed)",
    text: "text-failed",
    tone: "danger",
  },
  withdrawn: {
    label: "Withdrawn",
    color: "var(--locked)",
    text: "text-muted-foreground",
    tone: "neutral",
  },
  deferred: {
    label: "Deferred",
    color: "var(--warn)",
    text: "text-warn",
    tone: "warn",
  },
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

/** The status glyph. Decorative by default, so pair it with a word or pass a label. */
export function StatusIcon({
  status,
  size = 14,
  label,
  className,
}: {
  status: Status;
  size?: number;
  label?: string;
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
      {(status === "completed" ||
        status === "covered" ||
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

/** Icon plus word, with no fill. The word is muted for quiet states and colored for committed ones. */
export function StatusLabel({
  status,
  uncertain = false,
  className,
}: {
  status: Status;
  uncertain?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-[13px] leading-[18px]",
        STATUS[status].text,
        className,
      )}
    >
      <StatusIcon status={status} />
      {STATUS[status].label}
      {uncertain && <UncertainFlag />}
    </span>
  );
}

/** A tinted badge, for the one place a single status headlines a page. */
export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <Badge tone={STATUS[status].tone} size="md" className={className}>
      <StatusIcon status={status} />
      {STATUS[status].label}
    </Badge>
  );
}

/** "Has conditions": the catalogue lists something we can't check, such as instructor permission. */
export function UncertainFlag({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <span
      title="The catalogue lists a condition we can't check, like instructor permission."
      className="inline-flex items-center gap-1 text-warn"
    >
      <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
      {withLabel ? (
        <span className="font-medium text-[13px]">Has conditions</span>
      ) : (
        <span className="sr-only">Has conditions</span>
      )}
    </span>
  );
}
