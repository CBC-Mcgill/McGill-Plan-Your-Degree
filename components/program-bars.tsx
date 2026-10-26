import { cn } from "cn";
import type { ReactNode } from "react";
import { StatusBar } from "@/components/status";
import { COPY } from "@/lib/copy";
import { roomLeft } from "@/lib/engine/credits";
import type { CreditSplit, ProgramProgress } from "@/lib/engine/progress";

export interface CreditBar {
  label: ReactNode;
  done: number;
  split: CreditSplit;
  total: number;
  /** A line under the bar, such as where a generated program came from. */
  note?: ReactNode;
  /** The courses behind each part, for the legend's tooltips. */
  courses?: Record<keyof CreditSplit, string[]>;
  /** Counts requirements met instead of credits, for a program with no credit total. The page's heading says the number, so the bar has no legend. */
  requirements?: true;
}

/** Gives each legend item of the StatusBars inside a 44px tap target below 1024px. */
const LEGEND_TAPS =
  "max-lg:[&_button]:relative max-lg:[&_button]:after:absolute max-lg:[&_button]:after:inset-x-0 max-lg:[&_button]:after:-inset-y-3";

/** Wraps a StatusBar whose legend sits beside it, and moves the legend under the bar below 768px. */
export const BAR_WITH_LEGEND = `${LEGEND_TAPS} max-md:[&>div]:flex-col max-md:[&>div]:items-stretch max-md:[&>div]:gap-2`;

/** Under the program bar once every group is met short of the credit total: how many credits are missing and which ranges can take them. */
export function RoomLeft({
  progress,
  className,
}: {
  progress: ProgramProgress;
  className?: string;
}) {
  const room = roomLeft(progress);
  return (
    room && (
      <p className={className}>{COPY.roomLeft(room.missing, room.ranges)}</p>
    )
  );
}

/** The program's credits bar, and the second program's (a minor, a second major, the other joint honours component or a breadth component) and the extra minor's beside it at the same level. Three bars share a row from 1024px, and they stack below 768px. */
export function ProgramBars({
  program,
  seconds,
}: {
  program: CreditBar;
  seconds: readonly CreditBar[];
}) {
  if (seconds.length === 0 && program.requirements) {
    return (
      <span
        role="img"
        aria-label={COPY.requirementsMet(program.done, program.total)}
        className="block w-80 max-md:w-full"
      >
        <StatusBar {...program.split} total={program.total} />
      </span>
    );
  }
  if (seconds.length === 0) {
    return (
      <div className={BAR_WITH_LEGEND}>
        <StatusBar
          {...program.split}
          total={program.total}
          legend
          courses={program.courses}
          className="w-80 max-md:w-full"
        />
      </div>
    );
  }
  return (
    <section
      aria-label="Credit progress"
      className={cn(
        "grid max-w-[60rem] grid-cols-2 gap-x-12 max-md:grid-cols-1 max-md:gap-y-5",
        seconds.length > 1 &&
          "grid-cols-3 gap-x-8 max-lg:grid-cols-1 max-lg:gap-y-5",
        LEGEND_TAPS,
      )}
    >
      {[program, ...seconds].map((bar, index) => (
        // A subgrid keeps the bars on one line when one label wraps and another does not.
        // biome-ignore lint/suspicious/noArrayIndexKey: the bars never reorder
        <div key={index} className="row-span-3 grid grid-rows-subgrid gap-y-0">
          <p className="flex items-baseline-last justify-between gap-4 self-end">
            <span className="font-semibold">{bar.label}</span>
            <span className="shrink-0 text-fg-muted tabular-nums">
              {bar.done} of {bar.total} credits
            </span>
          </p>
          <StatusBar
            {...bar.split}
            total={bar.total}
            legend="below"
            courses={bar.courses}
            className="mt-2 w-full"
          />
          {bar.note && <p className="mt-1 text-fg-muted">{bar.note}</p>}
        </div>
      ))}
    </section>
  );
}
