"use client";

import { cn } from "cn";
import { GraduationCap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { type Status, StatusIcon } from "@/components/status";
import { BAND, CARD } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import type { Stage } from "@/lib/engine/stages";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { isDone } from "@/lib/profile/types";
import { useMedia } from "./use-media";

/** The term's glyph and status word, the line under its name on the path, and the `short` line a phone shows under it. */
export function describe(
  stage: Stage,
  nowKey: number,
): { status: Status; word: string; detail: string; short: string } {
  const credits = COPY.credits(stage.credits);
  switch (stage.state) {
    case "completed":
      return {
        status: "completed",
        word: "Completed",
        detail: `Completed · ${credits}`,
        short: credits,
      };
    case "current":
      return {
        status: "in-progress",
        word: "In progress",
        detail: `Current term · ${credits}`,
        short: credits,
      };
    case "planned": {
      // A future term can already hold courses the student registered for, which the transcript lists as in progress.
      const registered = stage.records.some((r) => r.status === "in-progress");
      const word = registered ? "Registered" : "Planned";
      return {
        status: registered ? "in-progress" : "planned",
        word,
        detail: `${word} · ${stage.count} ${stage.count === 1 ? "course" : "courses"} · ${credits}`,
        short: credits,
      };
    }
    case "past": {
      const unfinished =
        stage.records.filter((r) => !isDone(r.status)).length +
        stage.owed.length;
      const word = `${unfinished} not completed`;
      return {
        status: "withdrawn",
        word,
        detail: `${word} · ${credits}`,
        short: word,
      };
    }
    case "empty": {
      const word = stage.key < nowKey ? "No courses" : "Nothing planned";
      return { status: "available", word, detail: word, short: word };
    }
  }
}

/** A segment of the line that joins the terms, in the completed green up to the current term. It runs down the path, and across the strip below 1024px. */
function Line({ side, done }: { side: "before" | "after"; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-1/2 h-4 w-0.5 -translate-x-1/2 max-lg:top-[7px] max-lg:h-0.5 max-lg:w-auto max-lg:translate-x-0",
        side === "before"
          ? "top-0 max-lg:right-[calc(50%+0.5rem)] max-lg:left-0"
          : "bottom-0 max-lg:right-0 max-lg:bottom-auto max-lg:left-[calc(50%+0.5rem)]",
        done ? "bg-completed" : "bg-fg-subtle/40",
      )}
    />
  );
}

/** The warning count beside a term's name. */
function WarnCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-1.5 font-medium text-[13px] text-warn tabular-nums",
        className,
      )}
      style={{ background: "color-mix(in oklab, var(--warn) 11%, white)" }}
    >
      <TriangleAlert className="size-3.5" strokeWidth={2} />
      {count}
    </span>
  );
}

/** Below 1024px a term is a 144px column: the glyph on the line, then the name and a short line, centered. */
const STEP =
  "max-lg:h-auto max-lg:w-36 max-lg:shrink-0 max-lg:flex-col max-lg:gap-1.5 max-lg:px-0 max-lg:py-2 max-lg:text-center";

/** The cap at the end of the path, filled once the plan meets the program. */
function Cap({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-4 shrink-0 place-items-center rounded-full",
        done
          ? "bg-completed text-white"
          : "bg-bg text-fg-muted shadow-[inset_0_0_0_1.5px_var(--fg-subtle)]",
      )}
    >
      <GraduationCap className="size-2.5" strokeWidth={2.25} />
    </span>
  );
}

/** One tab per term, oldest first, joined by a line and ending at Graduation. Arrow keys move between terms. Below 1024px it is a strip that scrolls sideways and keeps the selected term in view. */
export function TermPath({
  stages,
  selected,
  onSelect,
  nowKey,
  graduation,
}: {
  stages: Stage[];
  selected: number;
  onSelect: (key: number) => void;
  nowKey: number;
  /** `set` is false when the term is an estimate from the start term. */
  graduation: { term: Term; set: boolean; satisfied: boolean };
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const across = useMedia("(max-width: 1023px)");
  // A segment is done once the term below it has started.
  const started = (stage: Stage | undefined) =>
    stage !== undefined && stage.key <= nowKey;

  function move(event: React.KeyboardEvent) {
    const at = stages.findIndex((stage) => stage.key === selected);
    const to =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? Math.min(stages.length - 1, at + 1)
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? Math.max(0, at - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? stages.length - 1
              : at;
    const stage = stages[to];
    if (!stage || to === at) return;
    event.preventDefault();
    onSelect(stage.key);
    tabs.current[to]?.focus();
  }

  // Only the strip scrolls sideways, so the path beside the card never moves.
  useEffect(() => {
    const box = strip.current;
    const tab = tabs.current[stages.findIndex((s) => s.key === selected)];
    if (!box || !tab || box.scrollWidth <= box.clientWidth) return;
    const outer = box.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    box.scrollLeft += inner.left - outer.left - (outer.width - inner.width) / 2;
  }, [selected, stages]);

  return (
    <div
      className={cn(
        CARD,
        "sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto max-lg:static max-lg:max-h-none max-lg:overflow-visible",
      )}
    >
      <div className={BAND}>
        <h2>Your path</h2>
      </div>
      <div
        ref={strip}
        className="p-2 max-lg:relative max-lg:flex max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:motion-safe:scroll-smooth"
      >
        <div
          role="tablist"
          aria-label="Terms"
          aria-orientation={across ? "horizontal" : "vertical"}
          onKeyDown={move}
          className="max-lg:flex"
        >
          {stages.map((stage, i) => {
            const isSelected = stage.key === selected;
            const { status, detail, short } = describe(stage, nowKey);
            const warnings = stage.warnings.length;
            return (
              <button
                key={stage.key}
                ref={(element) => {
                  tabs.current[i] = element;
                }}
                type="button"
                role="tab"
                id={`stage-${stage.key}`}
                aria-selected={isSelected}
                aria-controls="term-panel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(stage.key)}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-tint focus-visible:-outline-offset-2",
                  STEP,
                  isSelected && "selected",
                )}
              >
                <span className="relative flex h-full w-4 shrink-0 items-center justify-center max-lg:h-4 max-lg:w-full">
                  {i > 0 && <Line side="before" done={started(stage)} />}
                  <Line side="after" done={started(stages[i + 1])} />
                  <StatusIcon status={status} size={16} />
                </span>
                <span className="min-w-0 flex-1 max-lg:w-full max-lg:flex-none max-lg:px-2">
                  <span className="flex items-center justify-between gap-2 max-lg:justify-center">
                    <span className="truncate font-semibold">
                      {termLabel(stage.term)}
                    </span>
                    {warnings > 0 && (
                      <WarnCount count={warnings} className="max-lg:hidden" />
                    )}
                  </span>
                  {warnings > 0 && (
                    <span className="sr-only">
                      , with warnings: {COPY.warnings(warnings)},{" "}
                    </span>
                  )}
                  <span className="block truncate font-normal text-[13px] text-fg-muted leading-[18px] max-lg:sr-only">
                    {detail}
                  </span>
                  {/* Screen readers hear the full line above at every width. */}
                  <span
                    aria-hidden
                    className="hidden h-5 items-center justify-center gap-1.5 font-normal text-[13px] text-fg-muted leading-[18px] max-lg:flex"
                  >
                    <span className="truncate">{short}</span>
                    {warnings > 0 && <WarnCount count={warnings} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div
          className={cn(
            "flex h-12 items-center gap-3 px-2",
            STEP,
            "max-lg:w-auto max-lg:min-w-36 max-lg:whitespace-nowrap",
          )}
        >
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center max-lg:h-4 max-lg:w-full">
            <Line side="before" done={false} />
            <Cap done={graduation.satisfied} />
          </span>
          <span className="min-w-0 max-lg:w-full max-lg:px-2">
            <span className="block font-semibold">Graduation</span>
            <span className="block text-[13px] text-fg-muted leading-[18px]">
              {graduation.set ? "Expected " : ""}
              {termLabel(graduation.term)}
              {!graduation.set && (
                <>
                  , estimated ·{" "}
                  <Link href="/profile#graduation" className="link">
                    Set
                  </Link>
                </>
              )}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
