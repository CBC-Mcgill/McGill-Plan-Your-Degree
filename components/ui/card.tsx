import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

/** White surface with a 12px radius, a hairline and a soft bottom edge. The outline repeats the hairline above any full-bleed child, such as a hovered row. */
function Card({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="card"
      className={cn(
        "rounded-lg bg-card shadow-card outline outline-1 -outline-offset-1 outline-border",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
