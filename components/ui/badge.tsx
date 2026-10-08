import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

/** Tints come from the status tokens, written out in full so Tailwind sees every class. */
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-sm font-medium tabular-nums",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        completed:
          "bg-completed-surface text-[color-mix(in_oklab,var(--completed)_85%,black)]",
        "in-progress":
          "bg-in-progress-surface text-[color-mix(in_oklab,var(--in-progress)_85%,black)]",
        planned:
          "bg-planned-surface text-[color-mix(in_oklab,var(--planned)_85%,black)]",
        warn: "bg-warn-surface text-[color-mix(in_oklab,var(--warn)_85%,black)]",
        danger:
          "bg-failed-surface text-[color-mix(in_oklab,var(--danger)_85%,black)]",
        xp: "bg-xp-surface text-xp-foreground",
      },
      size: {
        sm: "h-5 gap-1 px-1.5 text-xs [&_svg]:size-3",
        md: "h-7 gap-1.5 px-2.5 text-[13px] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

/** Display-only status or count. 6px radius, never interactive. */
function Badge({
  tone,
  size,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
