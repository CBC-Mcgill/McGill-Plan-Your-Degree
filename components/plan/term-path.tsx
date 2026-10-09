"use client";

import { cn } from "cn";
import { GraduationCap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { type Status, StatusIcon } from "@/components/status";
import { Tooltip } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import type { Stage } from "@/lib/engine/stages";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { isDone } from "@/lib/profile/types";

/** The glyph, the word it stands for, and the line under the term. Only "Now" and an empty term show a word, the glyph and the tab's name carry the rest. */
function describe(
  stage: Stage,
  nowKey: number,
): { status: Status; word: string; detail: string } {
  const credits = COPY.credits(stage.credits);
  switch (stage.state) {
    case "completed":
      return { status: "completed", word: "Completed", detail: credits };
    case "current":
      return {
        status: "in-progress",
        word: "In progress",
        detail: `${COPY.now} · ${credits}`,
      };
    case "planned":
      return { status: "planned", word: "Planned", detail: credits };
    case "past": {
      const unfinished =
        stage.records.filter((r) => !isDone(r.status)).length +
        stage.owed.length;
      return {
        status: "withdrawn",
        word: `${unfinished} not completed`,
        detail: credits,
      };
    }
    case "empty": {
      const word = stage.key < nowKey ? "No courses" : "Nothing planned";
      return { status: "available", word, detail: word };
    }
  }
}

/** The cap at the end of the path, filled once the plan meets the program. */
function Cap({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-3.5 shrink-0 place-items-center",
        done ? "text-fg" : "text-fg-subtle",
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 14 14"
        className="absolute inset-0 size-3.5"
      >
        {done ? (
          <circle cx="7" cy="7" r="6.25" fill="currentColor" />
        ) : (
          <circle
            cx="7"
            cy="7"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )}
      </svg>
      <GraduationCap
        className={cn("relative size-2", done && "text-white")}
        strokeWidth={2.5}
      />
    </span>
  );
}

/** One tab per term, oldest first, with the Graduation stage at the end. Arrow keys move between terms. */
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
    <div className="sticky top-6 -mx-2 max-h-[calc(100vh-3rem)] overflow-y-auto px-2">
      <div
        role="tablist"
        aria-label="Terms"
        aria-orientation="vertical"
        onKeyDown={move}
      >
        {stages.map((stage, i) => {
          const isSelected = stage.key === selected;
          const { status, word, detail } = describe(stage, nowKey);
          const warned = stage.warnings.length > 0;
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
                "-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-start gap-2 rounded-md px-2 py-1 text-left hover:bg-tint focus-visible:-outline-offset-2",
                isSelected && "selected",
              )}
            >
              <Tooltip content={word}>
                <span className="flex h-5 shrink-0 items-center">
                  <StatusIcon status={status} />
                </span>
              </Tooltip>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {termLabel(stage.term)}
                  {warned && (
                    <TriangleAlert
                      aria-hidden
                      className="size-3.5 shrink-0 text-warn"
                    />
                  )}
                </span>
                {word !== detail && <span className="sr-only">{word}, </span>}
                {warned && <span className="sr-only">with warnings, </span>}
                <span className="block font-normal text-fg-muted">
                  {detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-start gap-2 py-1">
        <span className="flex h-5 items-center">
          <Cap done={graduation.satisfied} />
        </span>
        <span>
          <span className="block font-semibold">Graduation</span>
          <span className="block text-fg-muted">
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
  );
}
