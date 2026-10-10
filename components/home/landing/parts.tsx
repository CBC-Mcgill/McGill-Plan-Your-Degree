"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import { type ReactNode, useSyncExternalStore } from "react";
import { CourseCode } from "@/components/course-code";
import { sampleTerm } from "@/components/no-profile";
import type { Status } from "@/components/status";
import { termLabel } from "@/lib/profile/term-options";
import { subjectHue } from "@/lib/subject-color";

export interface Course {
  code: string;
  title: string;
  /** 3 unless the catalogue says otherwise. */
  credits?: number;
  grade?: string;
  /** Prerequisites the planner checks, all met in this sample. */
  needs?: string[];
}

export interface PathTerm {
  offset: number;
  status: Status;
  word: string;
  courses: Course[];
}

/**
 * A made-up Computer Science major who came from CEGEP: six terms, 90 credits.
 * The major's 63 (the 33 required credits, then theory, math and 400-level complementaries) plus 27 credits of electives, each course after its prerequisites and in a season it runs.
 */
export const PATH: PathTerm[] = [
  {
    offset: -2,
    status: "completed",
    word: "Completed",
    courses: [
      { code: "COMP 202", title: "Foundations of Programming", grade: "A" },
      { code: "MATH 240", title: "Discrete Structures", grade: "A-" },
      { code: "MATH 222", title: "Calculus 3", grade: "B+" },
      { code: "PSYC 100", title: "Introduction to Psychology", grade: "A" },
      {
        code: "ECON 208",
        title: "Microeconomic Analysis and Applications",
        grade: "A-",
      },
    ],
  },
  {
    offset: -1,
    status: "completed",
    word: "Completed",
    courses: [
      {
        code: "COMP 206",
        title: "Introduction to Software Systems",
        grade: "A-",
      },
      {
        code: "COMP 250",
        title: "Introduction to Computer Science",
        grade: "B+",
      },
      { code: "MATH 223", title: "Linear Algebra", grade: "B+" },
      { code: "LING 201", title: "Introduction to Linguistics", grade: "A" },
    ],
  },
  {
    offset: 0,
    status: "in-progress",
    word: "Current term",
    courses: [
      { code: "COMP 251", title: "Algorithms and Data Structures" },
      { code: "COMP 273", title: "Introduction to Computer Systems" },
      { code: "MATH 323", title: "Probability" },
      { code: "ECON 209", title: "Macroeconomic Analysis and Applications" },
      { code: "PSYC 215", title: "Social Psychology" },
    ],
  },
  {
    offset: 1,
    status: "planned",
    word: "Planned",
    courses: [
      {
        code: "COMP 302",
        title: "Programming Languages and Paradigms",
        needs: ["COMP 250", "MATH 240"],
      },
      {
        code: "COMP 303",
        title: "Software Design",
        needs: ["COMP 206", "COMP 250"],
      },
      { code: "COMP 310", title: "Operating Systems", needs: ["COMP 273"] },
      { code: "MATH 340", title: "Discrete Mathematics", needs: ["MATH 240"] },
      { code: "CLAS 203", title: "Greek Mythology" },
    ],
  },
  {
    offset: 2,
    status: "planned",
    word: "Planned",
    courses: [
      { code: "COMP 330", title: "Theory of Computation", needs: ["COMP 251"] },
      {
        code: "COMP 360",
        title: "Algorithm Design",
        needs: ["COMP 251", "MATH 240"],
      },
      {
        code: "COMP 424",
        title: "Artificial Intelligence",
        needs: ["COMP 206", "COMP 251", "MATH 323"],
      },
      {
        code: "COMP 535",
        title: "Computer Networks 1",
        credits: 4,
        needs: ["COMP 310"],
      },
      { code: "ANTH 202", title: "Socio-Cultural Anthropology" },
    ],
  },
  {
    offset: 3,
    status: "planned",
    word: "Planned",
    courses: [
      {
        code: "COMP 421",
        title: "Database Systems",
        needs: ["COMP 206", "COMP 251", "COMP 302"],
      },
      {
        code: "COMP 520",
        title: "Compiler Design",
        credits: 4,
        needs: ["COMP 273", "COMP 302"],
      },
      {
        code: "COMP 551",
        title: "Applied Machine Learning",
        credits: 4,
        needs: ["COMP 202", "MATH 222", "MATH 323"],
      },
      {
        code: "ARTH 204",
        title: "Introduction to Medieval Art and Architecture",
      },
      { code: "RELG 207", title: "Introduction to the Study of Religions" },
    ],
  },
];

export const credits = (course: Course) => course.credits ?? 3;
export const termCredits = (term: PathTerm) =>
  term.courses.reduce((sum, course) => sum + credits(course), 0);
/** 90, the credits a CEGEP student's degree needs, which the plan meets. */
export const TOTAL = PATH.reduce((sum, term) => sum + termCredits(term), 0);
export const termName = (offset: number) => termLabel(sampleTerm(offset));
export const GRADUATION = PATH.at(-1)?.offset ?? 3;

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
  const query = matchMedia(REDUCE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** The visitor's reduced motion setting, false on the server so hydration matches, then the real value. */
export function useReduce() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(REDUCE).matches,
    () => false,
  );
}

/** A met prerequisite: a green check that draws in, then the course code. It animates in on mount, unless an `AnimatePresence initial={false}` above it blocks first animations. */
export function Check({
  code,
  on,
  delay = 0,
  className,
}: {
  code: string;
  on: boolean;
  delay?: number;
  className?: string;
}) {
  const ease = { delay, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] } as const;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={ease}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] pr-1.5 pl-1 font-medium text-[12px] text-completed leading-none",
        className,
      )}
      style={{ background: "color-mix(in oklab, var(--completed) 11%, white)" }}
    >
      <svg viewBox="0 0 14 14" className="size-3" aria-hidden>
        <circle cx="7" cy="7" r="6.25" fill="currentColor" />
        <motion.path
          d="m4.4 7.2 1.8 1.8 3.5-3.7"
          fill="none"
          stroke="white"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={{ ...ease, delay: delay + 0.12 }}
        />
      </svg>
      {code}
    </motion.span>
  );
}

/** A sheet of paper standing for the unofficial transcript PDF, its lines in the subject colors of the courses on it. */
export function Sheet({
  className,
  lines,
  lit,
}: {
  className?: string;
  /** Course codes, one line each, grouped by term with a short heading line before each group. */
  lines: string[][];
  /** Lights the course lines one by one, in step with the rows they turn into. Leave it out for a plain sheet. */
  lit?: boolean;
}) {
  const starts = lines.map((_, g) =>
    lines.slice(0, g).reduce((sum, group) => sum + group.length, 0),
  );
  return (
    <div
      className={cn(
        "rounded-[6px] bg-white p-3.5 shadow-[0_24px_48px_-16px_rgb(5_10_25/0.55),0_0_0_1px_rgb(23_32_54/0.08)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="rounded-[4px] bg-fg px-1 font-bold text-[9px] text-white leading-4">
          PDF
        </span>
        <span className="truncate font-semibold text-[11px] text-fg leading-4">
          Unofficial transcript
        </span>
      </div>
      <div className="mt-1 h-1 w-16 rounded-[2px] bg-line" />
      {lines.map((group, g) => (
        <div key={group.join()} className="mt-3">
          <div
            className={cn(
              "h-1.5 rounded-[2px] bg-fg/70",
              g % 2 ? "w-14" : "w-12",
            )}
          />
          {group.map((code, n) => {
            const i = (starts[g] ?? 0) + n;
            const hue = subjectHue(code.split(" ")[0] ?? code);
            return (
              <div
                key={code}
                className="relative mt-1.5 flex items-center gap-1.5"
              >
                {lit !== undefined && (
                  <motion.span
                    aria-hidden
                    className="absolute -inset-x-1.5 -inset-y-[3px] rounded-[3px] bg-planned/12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: lit ? [0, 1, 0.35] : 0 }}
                    transition={{
                      delay: lit ? 0.1 + i * 0.09 : 0,
                      duration: 0.6,
                    }}
                  />
                )}
                <span
                  className="relative h-1.5 w-7 rounded-[2px]"
                  style={{ background: `var(--subject-${hue})`, opacity: 0.7 }}
                />
                <span
                  className="relative h-1.5 flex-1 rounded-[2px] bg-line"
                  style={{ maxWidth: `${62 + ((i * 23) % 34)}%` }}
                />
                <span className="relative ml-auto h-1.5 w-2.5 rounded-[2px] bg-fg/30" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A course row inside the mock app: glyph, code, title, then whatever the caller puts at the end. */
export function MockRow({
  glyph,
  code,
  title,
  children,
  className,
}: {
  glyph: ReactNode;
  code: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-3 border-line border-t px-4 first:border-t-0",
        className,
      )}
    >
      {glyph}
      <span className="w-[4.75rem] shrink-0 font-semibold">
        <CourseCode code={code} />
      </span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {children}
    </div>
  );
}
