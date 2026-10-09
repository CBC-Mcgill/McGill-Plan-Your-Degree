import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

const bannerVariants = cva(
  "flex items-start gap-2 text-fg [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "[&>svg]:text-fg-muted",
        warn: "[&>svg]:text-warn",
        danger: "[&>svg]:text-danger",
        success: "[&>svg]:text-fg-muted",
        progress: "[&>svg]:text-fg-muted",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

/** @deprecated Use `Notice`. */
function Banner({
  tone,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bannerVariants>) {
  return <div className={cn(bannerVariants({ tone }), className)} {...props} />;
}

export { Banner, bannerVariants };
