"use client";

import { cn } from "cn";
import { LockOpen } from "lucide-react";
import { DefinitionButton } from "@/components/ui/tooltip";
import type { Dependent, Priority } from "@/lib/engine/priority";
import { urgency } from "@/lib/engine/priority";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";

// Past this many codes a kind ends in "and 12 more", so the tip stays short.
const SHOWN = 6;

function codes(dependents: Dependent[]) {
  const named = dependents
    .slice(0, SHOWN)
    .map(({ code, corequisite }) =>
      corequisite ? `${code} (corequisite)` : code,
    );
  const more = dependents.length - SHOWN;
  return more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");
}

const sequence = (codes: string[]) =>
  `${codes.join(", then ")} ${codes.length === 1 ? "fits" : "fit"}`;

/** How late the course can start, only when that is within the next two terms, and what sets it: a planned course's term, or graduation for a required one. */
function deadline(priority: Priority, now: Term, graduation: Term) {
  const { latest, chain, planned } = priority;
  const when = urgency(priority, now);
  const last = chain.at(-1);
  if (!latest || !when || !last) return null;
  const by = termLabel(latest);
  if (planned) {
    const target = `${last} in ${termLabel(planned)}`;
    const between = chain.slice(0, -1);
    if (when === "late") {
      return `Take it as soon as you can. It is already late for ${target}.`;
    }
    return between.length > 0
      ? `Take it by ${by} so ${sequence(between)} before ${target}.`
      : `Take it by ${by}, before ${target}.`;
  }
  const end = `by ${termLabel(graduation)}, your last term`;
  return when === "late"
    ? `Take it as soon as you can. ${chain.join(", then ")} no longer ${chain.length === 1 ? "fits" : "fit"} ${end}.`
    : `Take it by ${by} so ${sequence(chain)} ${end}.`;
}

const unlocks = (n: number) =>
  `Unlocks ${n} ${n === 1 ? "course" : "courses"} in your program`;

/** The open lock and count alone, for a row that is a button itself, such as a search result. It has no tooltip of its own, so the pointer gets the text as a title and screen readers hear it with the row. */
export function PriorityCount({
  priority,
  now,
  graduation,
}: {
  priority: Priority;
  now: Term;
  graduation: Term;
}) {
  const n = priority.dependents.length;
  if (n === 0) return null;
  const due = deadline(priority, now, graduation);
  const text = due ? `${unlocks(n)}. ${due}` : unlocks(n);
  return (
    <span
      title={text}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 tabular-nums",
        due ? "font-semibold text-warn" : "text-fg-muted",
      )}
    >
      <LockOpen aria-hidden className="size-3.5" strokeWidth={2} />
      <span aria-hidden>{n}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/**
 * How many of the program's required and complementary courses still to take need this one first or alongside, as an open lock and a count.
 * Hover, focus or a click names them, and says how late the course can start when that is within the next two terms, which turns the count amber.
 * Nothing shows when no program course waits on it. Never put one inside a label, a link or a button.
 */
export function PriorityFlag({
  priority,
  now,
  graduation,
  className,
}: {
  priority: Priority;
  now: Term;
  /** The last term the student takes courses. */
  graduation: Term;
  className?: string;
}) {
  const { dependents } = priority;
  if (dependents.length === 0) return null;
  const required = dependents.filter((d) => d.kind === "required");
  const complementary = dependents.filter((d) => d.kind === "complementary");
  const summary = unlocks(dependents.length);
  const due = deadline(priority, now, graduation);
  const tip = (
    <span className="flex flex-col gap-1">
      <span className="font-semibold">{summary}</span>
      {required.length > 0 && <span>Required: {codes(required)}</span>}
      {complementary.length > 0 && (
        <span>Complementary: {codes(complementary)}</span>
      )}
      {due && <span>{due}</span>}
    </span>
  );
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center",
        due ? "font-semibold text-warn" : "text-fg-muted",
        className,
      )}
    >
      <DefinitionButton
        def={{ tip }}
        label={due ? `${summary}. ${due}` : summary}
        className={cn(
          "gap-1 rounded-md px-1 tabular-nums after:-inset-1.5",
          !due &&
            "hover:text-fg data-[state=delayed-open]:text-fg data-[state=instant-open]:text-fg",
        )}
      >
        <LockOpen aria-hidden className="size-3.5" strokeWidth={2} />
        {dependents.length}
      </DefinitionButton>
    </span>
  );
}
