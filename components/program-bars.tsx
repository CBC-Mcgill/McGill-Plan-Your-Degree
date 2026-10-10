import type { ReactNode } from "react";
import { StatusBar } from "@/components/status";
import type { CreditSplit } from "@/lib/engine/progress";

export interface CreditBar {
  label: ReactNode;
  done: number;
  split: CreditSplit;
  total: number;
  /** A line under the bar, such as where a generated program came from. */
  note?: ReactNode;
  /** The courses behind each part, for the legend's tooltips. */
  courses?: Record<keyof CreditSplit, string[]>;
}

/** Gives each legend item of the StatusBars inside a 44px tap target below 1024px. */
const LEGEND_TAPS =
  "max-lg:[&_button]:relative max-lg:[&_button]:after:absolute max-lg:[&_button]:after:inset-x-0 max-lg:[&_button]:after:-inset-y-3";

/** Wraps a StatusBar whose legend sits beside it, and moves the legend under the bar below 768px. */
export const BAR_WITH_LEGEND = `${LEGEND_TAPS} max-md:[&>div]:flex-col max-md:[&>div]:items-stretch max-md:[&>div]:gap-2`;

/** The program's credits bar, and the minor's beside it at the same level when the student has one. They stack below 768px. */
export function ProgramBars({
  program,
  minor,
}: {
  program: CreditBar;
  minor: CreditBar | null;
}) {
  if (!minor) {
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
      className={`grid max-w-[60rem] grid-cols-2 gap-x-12 max-md:grid-cols-1 max-md:gap-y-5 ${LEGEND_TAPS}`}
    >
      {[program, minor].map((bar, index) => (
        <div key={index === 0 ? "program" : "minor"}>
          <p className="flex items-baseline justify-between gap-4">
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
