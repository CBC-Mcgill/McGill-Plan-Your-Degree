import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const text = "px-3 text-fg hover:bg-tint";
const danger = "px-3 text-danger hover:bg-tint";

/** One red primary per screen at most, a text button for everything else. 36px tall, never a pill. */
const buttonVariants = cva(
  "inline-flex h-9 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold text-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary px-4 text-white hover:bg-primary-hover",
        text,
        danger,
        /** @deprecated Use `text`. */
        secondary: text,
        /** @deprecated Use `text`. */
        ghost: text,
        /** @deprecated Use `danger`. */
        destructive: danger,
      },
      /** A 36px square for an icon with an aria-label. */
      icon: { true: "w-9 px-0" },
      /** @deprecated Every button is 36px. Use `icon` for a square one. */
      size: {
        sm: "gap-1.5 px-2 [&_svg]:size-3.5",
        md: "",
        lg: "",
        icon: "w-9 px-0",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

function Button({
  className,
  variant,
  icon,
  size,
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
      className={cn(buttonVariants({ variant, icon, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
