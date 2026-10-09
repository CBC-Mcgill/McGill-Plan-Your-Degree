"use client";

import { cn } from "cn";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { Definition } from "@/lib/glossary";

/**
 * Click to expand (pattern B): a 44px button with a chevron that opens its content right below. `as="h2"` keeps a collapsed section's heading, with the chevron hung in the gutter so the text lines up with every other heading.
 * A `Term` cannot sit inside the button, so pass `def` to show a definition on the toggle's hover and focus. The dotted underline goes on `meta`, so a heading never carries one.
 */
export function Disclosure({
  summary,
  openSummary = summary,
  meta,
  as: Heading = "div",
  defaultOpen = false,
  def,
  children,
}: {
  summary: ReactNode;
  /** The summary while open. */
  openSummary?: ReactNode;
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
      className={cn(
        "-mr-2 flex min-h-11 items-center gap-2 rounded-md pr-2 text-left hover:bg-tint focus-visible:bg-tint focus-visible:-outline-offset-2",
        Heading === "h2"
          ? "-ml-7 w-[calc(100%+2.25rem)] pl-1"
          : "-ml-2 w-[calc(100%+1rem)] pl-2",
      )}
    >
      <Chevron aria-hidden className="size-4 shrink-0 text-fg-muted" />
      <span className="min-w-0 flex-1">{open ? openSummary : summary}</span>
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
        {open && children}
      </div>
    </div>
  );
}

/** The rest of a list behind "Show N more", which turns into "Show fewer" while open. The toggle stays under the rows it reveals. The one way to shorten a long list. */
export function ShowMore({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div>
      <div id={id} hidden={!open}>
        {open && children}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 text-left hover:bg-tint focus-visible:bg-tint focus-visible:-outline-offset-2"
      >
        <Chevron aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1">
          {open ? "Show fewer" : `Show ${count} more`}
        </span>
      </button>
    </div>
  );
}
