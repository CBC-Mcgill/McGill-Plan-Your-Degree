"use client";

import { cn } from "cn";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { Definition } from "@/lib/glossary";

/**
 * Click to expand (pattern B): a 44px button with a chevron that opens its content right below. `as="h2"` keeps a collapsed section's heading.
 * A `Term` cannot sit inside the button, so pass `def` to show a definition on the toggle's hover and focus. The dotted underline goes on `meta`, so a heading never carries one.
 */
export function Disclosure({
  summary,
  meta,
  as: Heading = "div",
  defaultOpen = false,
  def,
  children,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  as?: "h2" | "h3" | "div";
  defaultOpen?: boolean;
  def?: Definition;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const Chevron = open ? ChevronDown : ChevronRight;
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={() => setOpen(!open)}
      className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 text-left hover:bg-tint focus-visible:bg-tint focus-visible:-outline-offset-2"
    >
      <Chevron aria-hidden className="size-4 shrink-0 text-fg-muted" />
      <span className="min-w-0 flex-1">{summary}</span>
      {meta && (
        <span
          className={cn(
            "shrink-0 font-normal text-fg-muted text-sm tabular-nums",
            def &&
              "underline decoration-1 decoration-dotted decoration-fg-subtle underline-offset-3",
          )}
        >
          {meta}
        </span>
      )}
    </button>
  );
  return (
    <div>
      <Heading>
        {def ? (
          <Tooltip content={def.tip} align="start">
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </Heading>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
