"use client";

import { cn } from "cn";
import { GraduationCap, Minus, TriangleAlert } from "lucide-react";
import { useRef } from "react";
import { StatusIcon } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Stage } from "@/lib/engine/stages";
import { creditsText } from "@/lib/format";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { isDone } from "@/lib/profile/types";

function detail(stage: Stage, nowKey: number): string {
  const credits = creditsText(stage.credits);
  const courses = `${stage.count} ${stage.count === 1 ? "course" : "courses"}`;
  switch (stage.state) {
    case "completed":
      return `Completed · ${credits}`;
    case "current":
      return `Current term · ${credits}`;
    case "planned":
      return `Planned · ${courses} · ${credits}`;
    case "past": {
      const unfinished =
        stage.records.filter((r) => !isDone(r.status)).length +
        stage.owed.length;
      return unfinished > 0
        ? `${credits} · ${unfinished} not completed`
        : credits;
    }
    case "empty":
      return stage.key < nowKey ? "No courses" : "Nothing planned";
  }
}

function Line({ className, done }: { className: string; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-1/2 w-0.5 -translate-x-1/2",
        done ? "bg-completed" : "bg-border-strong",
        className,
      )}
    />
  );
}

/** The same glyphs as the course status, so a term reads like a course: dashed when empty, a check when done. */
function Node({ stage }: { stage: Stage }) {
  switch (stage.state) {
    case "completed":
      return <StatusIcon status="completed" size={16} className="relative" />;
    case "current":
      return <StatusIcon status="in-progress" size={16} className="relative" />;
    case "planned":
      return <StatusIcon status="planned" size={16} className="relative" />;
    case "past":
      return (
        <span
          aria-hidden
          className="relative grid size-4 place-items-center rounded-full bg-card text-locked shadow-[inset_0_0_0_1.5px_currentColor]"
        >
          <Minus className="size-2.5" strokeWidth={3} />
        </span>
      );
    case "empty":
      return <StatusIcon status="available" size={16} className="relative" />;
  }
}

/** One stage per term on a vertical path, with the Graduation stage at the end. Arrow keys move between terms. */
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
  graduation: { term: Term; satisfied: boolean };
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
    <Card className="sticky top-4 max-h-[calc(100vh-2rem)] self-start overflow-y-auto p-2">
      <h2 className="px-2 pt-1 pb-2 text-base">Your path</h2>
      <div
        role="tablist"
        aria-label="Terms"
        aria-orientation="vertical"
        onKeyDown={move}
      >
        {stages.map((stage, i) => {
          const isSelected = stage.key === selected;
          const next = stages[i + 1];
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
                "relative flex h-12 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-subtle",
                isSelected &&
                  "bg-subtle shadow-[inset_0_0_0_1px_var(--border)]",
              )}
            >
              <span className="relative flex h-full w-5 shrink-0 items-center justify-center">
                {i > 0 && (
                  <Line className="top-0 h-4" done={stage.key <= nowKey} />
                )}
                <Line
                  className="bottom-0 h-4"
                  done={next ? next.key <= nowKey : false}
                />
                <Node stage={stage} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold leading-5">
                    {termLabel(stage.term)}
                  </span>
                  {stage.warnings.length > 0 && (
                    <Badge tone="warn" title="Has warnings">
                      <TriangleAlert aria-hidden />
                      {stage.warnings.length}
                      <span className="sr-only">
                        {stage.warnings.length === 1 ? "warning" : "warnings"}
                      </span>
                    </Badge>
                  )}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground leading-[18px]">
                  {detail(stage, nowKey)}
                </span>
              </span>
            </button>
          );
        })}
        <div className="relative flex h-12 items-center gap-3 px-2">
          <span className="relative flex h-full w-5 shrink-0 items-center justify-center">
            <Line className="top-0 h-3.5" done={false} />
            <span
              aria-hidden
              className={cn(
                "relative grid size-5 place-items-center rounded-full",
                graduation.satisfied
                  ? "bg-completed text-white"
                  : "bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border-strong)]",
              )}
            >
              <GraduationCap className="size-3" strokeWidth={2} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold leading-5">
              Graduation
            </span>
            <span
              className={cn(
                "block truncate text-[13px] leading-[18px]",
                graduation.satisfied
                  ? "font-medium text-completed"
                  : "text-muted-foreground",
              )}
            >
              {graduation.satisfied
                ? "Your plan meets your program"
                : `Expected ${termLabel(graduation.term)}`}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
