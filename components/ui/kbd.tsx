import { cn } from "cn";
import type * as React from "react";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 font-sans items-center justify-center rounded-[5px] border border-border bg-card px-1 font-medium text-[11px] text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
