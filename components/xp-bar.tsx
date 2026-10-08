import { cn } from "cn";
import { Progress } from "@/components/ui/progress";

export function XpBar({
  xp,
  max,
  className,
}: {
  xp: number;
  max: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Progress
        value={xp}
        max={max}
        aria-label="Experience points"
        aria-valuetext={`${xp} of ${max} XP`}
        className="w-28 text-xp"
      />
      <span className="whitespace-nowrap font-semibold text-muted-foreground text-xs tabular-nums">
        {xp} / {max} XP
      </span>
    </div>
  );
}
