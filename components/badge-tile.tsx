import { cn } from "cn";
import { Check, Lock, type LucideIcon } from "lucide-react";

export function BadgeTile({
  name,
  description,
  icon: Icon,
  earned,
  className,
}: {
  name: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
  className?: string;
}) {
  const StateIcon = earned ? Check : Lock;

  return (
    <div
      data-earned={earned}
      className={cn(
        "flex w-44 flex-col items-center gap-2 rounded-lg border-2 p-4 text-center",
        earned
          ? "border-available/40 bg-card shadow-edge-available"
          : "border-border-strong border-dashed bg-muted/40",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          earned
            ? "bg-available-surface text-available"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-7" />
      </span>
      <p className="font-bold">{name}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
      <p
        className={cn(
          "inline-flex items-center gap-1 font-semibold text-xs",
          earned ? "text-available" : "text-muted-foreground",
        )}
      >
        <StateIcon aria-hidden className="size-3.5" strokeWidth={2.75} />
        {earned ? "Earned" : "Locked"}
      </p>
    </div>
  );
}
