import { cn } from "cn";
import type * as React from "react";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-bg px-1 font-sans text-[11px] text-fg-muted shadow-[inset_0_-1px_0_var(--line)]",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
