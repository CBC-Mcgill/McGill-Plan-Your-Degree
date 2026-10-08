import { cn } from "cn";
import { Progress } from "@/components/ui/progress";

const format = (n: number) => n.toLocaleString("en-US");

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
        aria-valuetext={`${format(xp)} of ${format(max)} XP`}
        className="w-28 text-xp"
      />
      <span className="whitespace-nowrap font-semibold text-muted-foreground text-xs tabular-nums">
        {format(xp)} / {format(max)} XP
      </span>
    </div>
  );
}
