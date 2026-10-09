import { cn } from "cn";
import type * as React from "react";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded-md bg-tint px-1.5 py-1 font-sans text-fg-muted text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
