import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

/** Tints come from the status tokens, written out in full so Tailwind sees every class. */
const bannerVariants = cva(
  "flex items-start gap-2.5 rounded-md p-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "bg-subtle shadow-[inset_0_0_0_1px_var(--border)]",
        warn: "bg-warn-surface shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--warn)_25%,white)]",
        danger:
          "bg-failed-surface text-[color-mix(in_oklab,var(--danger)_85%,black)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--danger)_25%,white)]",
        success:
          "bg-completed-surface text-completed shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--completed)_25%,white)]",
        progress:
          "bg-in-progress-surface text-in-progress shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--in-progress)_25%,white)]",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

/** A message that sits in the page, not over it. Use `role` for ones that appear after an action. */
function Banner({
  tone,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bannerVariants>) {
  return <div className={cn(bannerVariants({ tone }), className)} {...props} />;
}

export { Banner, bannerVariants };
