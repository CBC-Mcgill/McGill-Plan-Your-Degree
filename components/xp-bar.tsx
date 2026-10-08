import { cn } from "cn";
import { ProgressBar } from "@/components/ui/progress";

const format = (n: number) => n.toLocaleString("en-US");

/** XP toward the next level: a gold bar and its caption. */
export function XpBar({
  xp,
  max,
  label,
  className,
  barClassName,
  captionClassName,
}: {
  xp: number;
  max: number;
  /** Replaces the default "xp / max XP" text. */
  label?: string;
  className?: string;
  barClassName?: string;
  captionClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <ProgressBar
        value={xp}
        max={max}
        fill="xp"
        label="Experience points"
        valueText={`${format(xp)} of ${format(max)} XP`}
        className={cn("w-24", barClassName)}
      />
      <span
        className={cn(
          "whitespace-nowrap text-muted-foreground text-xs tabular-nums",
          captionClassName,
        )}
      >
        {label ?? `${format(xp)} / ${format(max)} XP`}
      </span>
    </div>
  );
}
