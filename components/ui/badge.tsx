import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap text-sm tabular-nums [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "text-fg-muted",
        completed: "text-fg-muted",
        "in-progress": "text-fg-muted",
        planned: "text-fg-muted",
        warn: "text-warn",
        danger: "text-danger",
      },
      size: { sm: "", md: "" },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

/** @deprecated Every badge was a box. Write the word in --fg-muted, or use `StatusLabel`. */
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
