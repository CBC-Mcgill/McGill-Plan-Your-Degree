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
}: {
  code: string;
  on: boolean;
  delay?: number;
}) {
  const ease = { delay, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] } as const;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={ease}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] pr-1.5 pl-1 font-medium text-[12px] text-completed leading-none"
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

/** The red tile with the martlet rising out of the ring (brand/masters/pyd-tile.svg). */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 256 256" className={className}>
      <rect width="256" height="256" rx="64" fill="#da1a2e" />
      <path
        fill="#fff"
        d="M179.43 125.64C179.43 159.97 151.6 187.8 117.27 187.8C82.94 187.8 55.11 159.97 55.11 125.64C55.11 91.31 82.94 63.48 117.27 63.48C129.09 63.48 140.13 66.78 149.54 72.5Q148.2 74.41 146.83 76.52Q144.3 80.41 142.95 82.31Q142.48 82.91 141.99 83.51C134.74 79.25 126.29 76.8 117.27 76.8C90.3 76.8 68.43 98.67 68.43 125.64C68.43 152.61 90.3 174.48 117.27 174.48C144.24 174.48 166.11 152.61 166.11 125.64C166.11 121.12 165.5 116.74 164.35 112.59Q170.62 109.36 175.32 105.76Q175.66 105.5 176 105.23C178.22 111.62 179.43 118.49 179.43 125.64ZM201.05 63.29 193.53 73.86C190.19 83.03 182.67 93.6 172.17 101.65C161.66 109.7 142.37 116.67 123.34 121.04L94.81 147.71L110.52 121.37Q142.09 111.15 165.23 97.77Q165.37 97.69 165.49 97.57Q169.76 93.35 171.13 88.87Q172.56 84.18 170.52 80.35Q170.12 79.6 169.27 79.67Q159.04 80.53 146.55 86.12C146.73 85.88 146.92 85.65 147.1 85.41C152.75 77.48 157.06 68.61 165.35 62.57C173.33 57.5 183.4 57.9 189.36 62.94ZM108.17 113.49Q127 98.75 142.42 90.93Q157.03 83.53 168.6 82.33Q170.94 87.94 164.66 94.71Q164.24 95.16 163.79 95.61Q139.71 109.51 106.35 119.99Q105.81 120.15 105.28 120.32Q101.03 121.64 96.63 122.91Q98.02 121.73 99.39 120.58Q103.86 116.86 108.16 113.5ZM101.81 115.25Q98.52 117.91 95.13 120.78L79.23 121.5ZM180.74 66.16C180.74 64.16 179.12 62.54 177.12 62.54C175.12 62.54 173.49 64.16 173.49 66.16C173.49 68.17 175.12 69.79 177.12 69.79C179.12 69.79 180.74 68.17 180.74 66.16Z"
      />
    </svg>
  );
}
