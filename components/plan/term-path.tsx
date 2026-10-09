"use client";

import { cn } from "cn";
import { GraduationCap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { type Status, StatusIcon } from "@/components/status";
import { BAND, CARD } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import type { Stage } from "@/lib/engine/stages";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { isDone } from "@/lib/profile/types";

/** The term's glyph and status word, and the line under its name on the path. */
export function describe(
  stage: Stage,
  nowKey: number,
): { status: Status; word: string; detail: string } {
  const credits = COPY.credits(stage.credits);
  switch (stage.state) {
    case "completed":
      return {
        status: "completed",
        word: "Completed",
        detail: `Completed · ${credits}`,
      };
    case "current":
      return {
        status: "in-progress",
        word: "In progress",
        detail: `Current term · ${credits}`,
      };
    case "planned": {
      // A future term can already hold courses the student registered for, which the transcript lists as in progress.
      const registered = stage.records.some((r) => r.status === "in-progress");
      const word = registered ? "Registered" : "Planned";
      return {
        status: registered ? "in-progress" : "planned",
        word,
        detail: `${word} · ${stage.count} ${stage.count === 1 ? "course" : "courses"} · ${credits}`,
      };
    }
    case "past": {
      const unfinished =
        stage.records.filter((r) => !isDone(r.status)).length +
        stage.owed.length;
      const word = `${unfinished} not completed`;
      return { status: "withdrawn", word, detail: `${word} · ${credits}` };
    }
    case "empty": {
      const word = stage.key < nowKey ? "No courses" : "Nothing planned";
      return { status: "available", word, detail: word };
    }
  }
}

/** A segment of the line that joins the terms, in the completed green up to the current term. */
function Line({ className, done }: { className: string; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-1/2 w-0.5 -translate-x-1/2",
        done ? "bg-completed" : "bg-fg-subtle/40",
        className,
      )}
    />
  );
}

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

/** One tab per term, oldest first, joined by a line and ending at Graduation. Arrow keys move between terms. */
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

  return (
    <div
      className={cn(
        CARD,
        "sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto",
      )}
    >
      <div className={BAND}>
        <h2>Your path</h2>
      </div>
      <div className="p-2">
        <div
          role="tablist"
          aria-label="Terms"
          aria-orientation="vertical"
          onKeyDown={move}
        >
          {stages.map((stage, i) => {
            const isSelected = stage.key === selected;
            const { status, detail } = describe(stage, nowKey);
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
                  isSelected && "selected",
                )}
              >
                <span className="relative flex h-full w-4 shrink-0 items-center justify-center">
                  {i > 0 && (
                    <Line className="top-0 h-4" done={started(stage)} />
                  )}
                  <Line
                    className="bottom-0 h-4"
                    done={started(stages[i + 1])}
                  />
                  <StatusIcon status={status} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">
                      {termLabel(stage.term)}
                    </span>
                    {warnings > 0 && (
                      <span
                        aria-hidden
                        className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-1.5 font-medium text-[13px] text-warn tabular-nums"
                        style={{
                          background:
                            "color-mix(in oklab, var(--warn) 11%, white)",
                        }}
                      >
                        <TriangleAlert className="size-3.5" strokeWidth={2} />
                        {warnings}
                      </span>
                    )}
                  </span>
                  {warnings > 0 && (
                    <span className="sr-only">
                      , with warnings: {COPY.warnings(warnings)},{" "}
                    </span>
                  )}
                  <span className="block truncate font-normal text-[13px] text-fg-muted leading-[18px]">
                    {detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex h-12 items-center gap-3 px-2">
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center">
            <Line className="top-0 h-4" done={false} />
            <Cap done={graduation.satisfied} />
          </span>
          <span className="min-w-0">
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
