"use client";

import { cn } from "cn";
import { ChevronDown, ChevronRight, ChevronUp, Info } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { CARD } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { Definition } from "@/lib/glossary";

/**
 * Click to expand (pattern B): a 44px button with a chevron that opens its content right below. Inside a card it is a row, reaching the card's edges with a hairline above.
 * `as="h2"` makes a collapsed section instead: a card whose grey band is the button, with the chevron on the right.
 * A `Term` cannot sit inside the button, so pass `def` to show a definition on the toggle's hover and focus. An info icon after `meta` says so.
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
  const section = Heading === "h2";
  const Chevron = section
    ? open
      ? ChevronUp
      : ChevronDown
    : open
      ? ChevronDown
      : ChevronRight;
  const chevron = (
    <Chevron aria-hidden className="size-4 shrink-0 text-fg-muted" />
  );
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex min-h-11 items-center text-left hover:bg-tint focus-visible:bg-tint focus-visible:-outline-offset-2",
        section
          ? "w-full gap-4 rounded-[inherit] px-5 py-3"
          : "-mx-5 w-[calc(100%+2.5rem)] gap-2 px-5",
      )}
    >
      {!section && chevron}
      <span className="min-w-0 flex-1">{open ? openSummary : summary}</span>
      {meta && (
        <span className="inline-flex shrink-0 items-center gap-1 font-normal text-fg-muted text-sm tabular-nums">
          {meta}
          {def && <Info aria-hidden className="size-4" strokeWidth={1.75} />}
        </span>
      )}
      {section && chevron}
    </button>
  );
  const trigger = def ? (
    <Tooltip content={def.tip} align="start">
      {button}
    </Tooltip>
  ) : (
    button
  );
  if (section) {
    return (
      <div className={CARD}>
        <h2
          className={cn(
            "bg-subtle",
            open ? "rounded-t-lg border-line border-b" : "rounded-lg",
          )}
        >
          {trigger}
        </h2>
        <div id={id} hidden={!open} className="px-5 py-4">
          {open && children}
        </div>
      </div>
    );
  }
  return (
    <div className="-mx-5 border-line border-t px-5 first:border-t-0">
      <Heading>{trigger}</Heading>
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
        // -mt-px lays the hairline over a row's own bottom line, if it has one.
        className="-mx-5 -mt-px flex min-h-11 w-[calc(100%+2.5rem)] items-center gap-2 border-line border-t px-5 text-left hover:bg-tint focus-visible:bg-tint focus-visible:-outline-offset-2"
      >
        <Chevron aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1">
          {open ? "Show fewer" : `Show ${count} more`}
        </span>
      </button>
    </div>
  );
}
