import { cn } from "cn";

const fills = {
  completed: "bg-completed",
  "in-progress": "bg-in-progress",
  planned: "bg-planned",
  primary: "bg-primary",
  warn: "bg-warn",
} as const;

export type ProgressFill = keyof typeof fills;

/** A 6px bar. Pass `valueText` when "12 of 40" reads better than the raw number. */
function ProgressBar({
  value,
  max,
  fill = "completed",
  label,
  valueText,
  className,
}: {
  value: number;
  max: number;
  fill?: ProgressFill;
  label: string;
  valueText?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-track",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          fills[fill],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const ringStroke = {
  completed: "stroke-completed",
  "in-progress": "stroke-in-progress",
  planned: "stroke-planned",
  primary: "stroke-primary",
  warn: "stroke-warn",
} as const;

const RADIUS = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring for fractions in dense headers, drawn on the same 14px grid as the status icons. */
function ProgressRing({
  value,
  max,
  size = 14,
  fill = "completed",
  label,
}: {
  value: number;
  max: number;
  size?: number;
  fill?: ProgressFill;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="-rotate-90 shrink-0"
    >
      <circle
        cx="7"
        cy="7"
        r={RADIUS}
        fill="none"
        strokeWidth="2"
        className="stroke-track"
      />
      <circle
        cx="7"
        cy="7"
        r={RADIUS}
        fill="none"
        strokeWidth="2"
        strokeDasharray={`${CIRCUMFERENCE * pct} ${CIRCUMFERENCE}`}
        strokeLinecap={pct > 0 && pct < 1 ? "round" : "butt"}
        className={ringStroke[fill]}
      />
    </svg>
  );
}

export { ProgressBar, ProgressRing };
