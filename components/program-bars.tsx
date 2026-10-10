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

/** The program's credits bar, and the minor's beside it at the same level when the student has one. */
export function ProgramBars({
  program,
  minor,
}: {
  program: CreditBar;
  minor: CreditBar | null;
}) {
  if (!minor) {
    return (
      <StatusBar
        {...program.split}
        total={program.total}
        legend
        courses={program.courses}
        className="w-80"
      />
    );
  }
  return (
    <section
      aria-label="Credit progress"
      className="grid max-w-[60rem] grid-cols-2 gap-x-12"
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
