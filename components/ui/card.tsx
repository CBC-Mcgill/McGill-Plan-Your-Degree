import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

/** @deprecated Space separates content now. Use `Section`. */
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
        "rounded-lg bg-bg outline outline-1 -outline-offset-1 outline-tint",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
