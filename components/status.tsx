import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { DefinitionButton, Tooltip } from "@/components/ui/tooltip";
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

/** "Has conditions": the catalogue lists something we can't check, such as instructor permission. A focusable icon named "Has conditions" with the definition on hover, focus and click (D21), its target padded to 26px without moving the layout. Never put it inside a link or a button. */
export function UncertainFlag() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center text-warn">
      <DefinitionButton
        def={GLOSSARY.hasConditions}
        label={COPY.hasConditions}
        className="after:-inset-1.5"
      >
        <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
      </DefinitionButton>
    </span>
  );
}

const TINTED: ReadonlySet<Status> = new Set([
  "completed",
  "covered",
  "transfer",
  "exemption",
  "in-progress",
  "planned",
  "failed",
  "deferred",
]);

/** The glyph and word on a soft tint of the status hue, 6px corners, never a pill. Can take is outlined and locked or withdrawn is grey, all at AA contrast. `word` replaces the status word, as "Not offered" does on Browse. */
export function StatusBadge({
  status,
  word = STATUS[status].label,
}: {
  status: Status;
  word?: string;
}) {
  const { color, text } = STATUS[status];
  return (
    <span
      className={cn(
        "-my-0.5 inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 font-medium text-[13px]",
        status === "available" &&
          "bg-bg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg-subtle)_32%,white)]",
        !TINTED.has(status) && status !== "available" && "bg-tint",
      )}
      style={{
        color: text,
        background: TINTED.has(status)
          ? `color-mix(in oklab, ${color} 11%, white)`
          : undefined,
      }}
    >
      <StatusIcon status={status} />
      {word}
    </span>
  );
}

const BAR_PARTS = [
  ["completed", "completed", "earned"],
  ["inProgress", "in-progress", "in progress"],
  ["planned", "planned", "planned"],
] as const;

/**
 * Credits as one 6px bar: earned, in progress and planned in their status colors, what is left in grey. Screen readers hear it as one sentence.
 * `legend` adds a glyph and count for each part beside it. Give it a width with `className`.
 */
export function StatusBar({
  completed,
  inProgress,
  planned = 0,
  total,
  legend = false,
  className,
}: {
  completed: number;
  inProgress: number;
  planned?: number;
  total: number;
  legend?: boolean;
  className?: string;
}) {
  const values = { completed, inProgress, planned };
  const whole = Math.max(total, completed + inProgress + planned);
  const parts = BAR_PARTS.filter(([key]) => values[key] > 0);
  const sentence = parts.length
    ? parts.map(([key, , word]) => `${values[key]} ${word}`).join(", ")
    : "0 earned";
  const bar = (
    <span
      role="img"
      aria-label={`${sentence} of ${total} credits`}
      className={cn(
        "flex h-1.5 overflow-hidden rounded-full bg-line",
        className,
      )}
    >
      {parts.map(([key, status]) => (
        <span
          key={key}
          className="h-full border-bg border-l first:border-l-0"
          style={{
            width: `${(values[key] / whole) * 100}%`,
            background: STATUS[status].color,
          }}
        />
      ))}
    </span>
  );
  if (!legend) return bar;
  return (
    <div className="flex items-center gap-6">
      {bar}
      <p
        aria-hidden
        className="flex items-center gap-4 text-fg-muted tabular-nums"
      >
        {BAR_PARTS.map(([key, status, word]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <StatusIcon status={status} />
            {values[key]} {word}
          </span>
        ))}
      </p>
    </div>
  );
}
