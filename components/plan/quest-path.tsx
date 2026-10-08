"use client";

import { cn } from "cn";
import { CalendarDays, Check, Clock, GraduationCap, Minus } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import type { Stage, StageState } from "@/lib/engine/stages";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";
import { isDone } from "@/lib/profile/types";

/** Height of one stage in rem. The line between stages is measured in whole stages. */
const ROW = 3.5;

const NODE: Record<StageState, string> = {
  completed: "border-completed bg-completed text-white",
  current:
    "border-in-progress bg-in-progress text-white ring-4 ring-in-progress/20",
  planned: "border-planned bg-planned text-white",
  past: "border-locked bg-locked-surface text-locked",
  empty: "border-border-strong border-dashed bg-card text-muted-foreground",
};

const POP = { type: "spring", stiffness: 500, damping: 18 } as const;

function detail(stage: Stage, nowKey: number): string {
  const credits = `${stage.credits} credits`;
  const courses = `${stage.count} ${stage.count === 1 ? "course" : "courses"}`;
  switch (stage.state) {
    case "completed":
      return `Completed · ${credits}`;
    case "current":
      return `Current term · ${credits}`;
    case "planned":
      return `Planned · ${courses} · ${credits}`;
    case "past": {
      const unfinished = stage.records.filter((r) => !isDone(r.status)).length;
      return unfinished > 0
        ? `${credits} · ${unfinished} not completed`
        : credits;
    }
    case "empty":
      return stage.key < nowKey ? "No courses" : "Nothing planned";
  }
}

function Node({ stage }: { stage: Stage }) {
  const { state, count, warnings } = stage;
  return (
    <span aria-hidden className="relative z-10 size-10 shrink-0">
      <motion.span
        key={`${state}-${count}`}
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={POP}
        className={cn(
          "grid size-10 place-items-center rounded-full border-2 font-extrabold",
          NODE[state],
        )}
      >
        {state === "completed" ? (
          <Check aria-hidden className="size-5" strokeWidth={3.5} />
        ) : state === "current" ? (
          <Clock aria-hidden className="size-5" strokeWidth={2.75} />
        ) : state === "planned" ? (
          <CalendarDays aria-hidden className="size-5" strokeWidth={2.5} />
        ) : state === "past" ? (
          <Minus aria-hidden className="size-5" strokeWidth={3} />
        ) : null}
      </motion.span>
      {warnings.length > 0 && (
        <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-card bg-primary font-extrabold text-primary-foreground text-xs leading-none">
          !
        </span>
      )}
    </span>
  );
}

/** One stage per term on a vertical path, with the Graduation stage at the end. Arrow keys move between terms. */
export function QuestPath({
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
  const reached = stages.filter((stage) => stage.key <= nowKey).length;
  const filled = Math.max(0, reached - 1);

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
    <div className="sticky top-4 max-h-[calc(100vh-2rem)] self-start overflow-y-auto rounded-lg border-2 border-border bg-card p-3">
      <h2 className="px-2 pb-2 text-lg">Your path</h2>
      <div className="relative">
        <span
          aria-hidden
          className="absolute top-7 left-[1.625rem] z-[5] w-1 rounded-full bg-border-strong"
          style={{ height: `${stages.length * ROW}rem` }}
        />
        <motion.span
          aria-hidden
          className="absolute top-7 left-[1.625rem] z-[5] w-1 rounded-full bg-completed"
          initial={false}
          animate={{ height: `${filled * ROW}rem` }}
          transition={{ type: "spring", bounce: 0.1, duration: 0.8 }}
        />
        <div
          role="tablist"
          aria-label="Terms"
          aria-orientation="vertical"
          onKeyDown={move}
        >
          {stages.map((stage, i) => {
            const isSelected = stage.key === selected;
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
                className="relative flex h-14 w-full items-center gap-3 rounded-md px-2 text-left transition-[background-color] hover:bg-muted/60"
              >
                {isSelected && (
                  <motion.span
                    layoutId="stage-highlight"
                    aria-hidden
                    className="absolute inset-0 rounded-md border-2 border-border-strong bg-muted"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Node stage={stage} />
                <span className="relative flex min-w-0 flex-col">
                  <span className="font-extrabold">
                    {termLabel(stage.term)}
                  </span>
                  <span className="truncate text-muted-foreground text-sm">
                    {detail(stage, nowKey)}
                  </span>
                  {stage.warnings.length > 0 && (
                    <span className="sr-only">
                      {stage.warnings.length === 1
                        ? "1 warning"
                        : `${stage.warnings.length} warnings`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex h-14 items-center gap-3 px-2">
          <span aria-hidden className="relative z-10 size-10 shrink-0">
            <motion.span
              key={String(graduation.satisfied)}
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={POP}
              className={cn(
                "grid size-10 place-items-center rounded-full border-2",
                graduation.satisfied
                  ? "border-available bg-available-surface text-available ring-4 ring-available/20"
                  : "border-border-strong border-dashed bg-card text-muted-foreground",
              )}
            >
              <GraduationCap aria-hidden className="size-5" />
            </motion.span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-extrabold">Graduation</span>
            <span
              className={cn(
                "truncate text-sm",
                graduation.satisfied
                  ? "font-semibold text-available"
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
    </div>
  );
}
