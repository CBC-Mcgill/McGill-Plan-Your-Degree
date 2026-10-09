import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

/** One red primary per screen at most, a white bevelled button for everything else. 36px tall with 8px corners, never a pill. A disabled primary turns neutral, since red means "do this". */
const buttonVariants = cva(
  "inline-flex h-9 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold text-sm transition-[background-color,box-shadow,translate] duration-100 active:translate-y-px active:shadow-pressed disabled:pointer-events-none motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary px-4 text-white shadow-primary hover:bg-primary-hover disabled:bg-tint disabled:text-fg-muted disabled:shadow-none",
        secondary:
          "bg-bg px-3 text-fg shadow-button hover:bg-subtle disabled:opacity-50",
        danger:
          "bg-bg px-3 text-danger shadow-button hover:bg-subtle disabled:opacity-50",
      },
      /** A 36px square for an icon with an aria-label. */
      icon: { true: "w-9 px-0" },
    },
    defaultVariants: { variant: "primary" },
  },
);

function Button({
  className,
  variant,
  icon,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, icon }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
