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
        "flex w-44 flex-col items-center gap-2 rounded-lg p-4 text-center",
        earned
          ? "bg-card shadow-card"
          : "border border-border-strong border-dashed bg-subtle",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full",
          earned
            ? "bg-xp-surface text-xp-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <p className="font-semibold">{name}</p>
      <p className="text-[13px] text-muted-foreground leading-[18px]">
        {description}
      </p>
      <p
        className={cn(
          "inline-flex items-center gap-1 font-medium text-xs",
          earned ? "text-xp-foreground" : "text-muted-foreground",
        )}
      >
        <StateIcon aria-hidden className="size-3.5" strokeWidth={2} />
        {earned ? "Earned" : "Locked"}
      </p>
    </div>
  );
}
