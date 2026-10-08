"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

// Fill color follows the root's text color, so callers set it with a text-* class.
function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const percent = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100));

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-muted text-primary",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator asChild>
        <motion.div
          data-slot="progress-indicator"
          className="size-full rounded-full bg-current"
          initial={{ x: "-100%" }}
          animate={{ x: `${percent - 100}%` }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.8 }}
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
