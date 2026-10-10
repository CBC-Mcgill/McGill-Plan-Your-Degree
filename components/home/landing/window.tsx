"use client";

import { cn } from "cn";
import { FileUp, GraduationCap, Search } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { STATUS, StatusBadge, StatusIcon } from "@/components/status";
import { BAND, CARD } from "@/components/ui/card";
import {
  Check,
  credits,
  GRADUATION,
  MockRow,
  PATH,
  Sheet,
  TOTAL,
  termCredits,
  termName,
} from "./parts";

const EASE = [0.2, 0.7, 0.2, 1] as const;

/** How long each step holds: 0 empty, 1 the PDF lands, 2 to 7 one more term filled each, 8 fading out before the loop starts over. */
const HOLD = [800, 1000, 850, 850, 850, 1250, 1250, 3600, 450];
const FINAL = 7;

/** The planner in an app window: a transcript drops in, the terms fill one after another, prerequisites tick and the credits bar fills to graduation. Loops while on screen. */
export function PlannerWindow({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15 });
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const timer = setTimeout(() => {
      if (step === HOLD.length - 1) {
        setStep(0);
        setCycle((c) => c + 1);
      } else setStep(step + 1);
    }, HOLD[step]);
    return () => clearTimeout(timer);
  }, [reduce, inView, step]);

  const shown = reduce ? FINAL : step;
  const filled = Math.min(PATH.length, Math.max(0, shown - 1));

  return (
    <div ref={ref} className="relative">
      <div className="relative overflow-hidden rounded-xl bg-page text-[13px] text-fg leading-[18px] shadow-[0_40px_80px_-30px_rgb(23_32_54/0.35),0_0_0_1px_rgb(23_32_54/0.08)]">
        <Chrome />
        <motion.div
          initial={false}
          animate={{ opacity: shown === HOLD.length - 1 ? 0 : 1 }}
          transition={{ duration: 0.4 }}
        >
          <Page key={reduce ? "still" : cycle} filled={filled} />
          <motion.div
            className="absolute inset-x-3 top-[5.75rem] bottom-3 grid place-items-end justify-center rounded-lg border-[1.5px] border-planned/45 border-dashed bg-[color-mix(in_oklab,var(--planned)_7%,transparent)] pb-8 font-medium text-planned"
            initial={false}
            animate={{ opacity: shown === 1 ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="flex items-center gap-2 rounded-md bg-bg px-3 py-1.5 shadow-float">
              <FileUp className="size-4" strokeWidth={2} />
              Drop your transcript PDF to import it
            </span>
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        className="absolute top-[5.25rem] left-1/2 w-[10.75rem] -translate-x-1/2"
        initial={false}
        animate={
          shown === 0
            ? { y: -96, opacity: 0, rotate: -10, scale: 1.12 }
            : shown === 1
              ? { y: 0, opacity: 1, rotate: -4, scale: 1 }
              : { y: 24, opacity: 0, rotate: 0, scale: 0.55 }
        }
        transition={
          shown === 1
            ? {
                y: { type: "spring", stiffness: 150, damping: 17 },
                rotate: { type: "spring", stiffness: 150, damping: 17 },
                scale: { type: "spring", stiffness: 150, damping: 17 },
                opacity: { duration: 0.2 },
              }
            : { duration: 0.35, ease: EASE }
        }
      >
        <Sheet
          lines={PATH.slice(0, 3).map((term) =>
            term.courses.slice(0, 3).map((course) => course.code),
          )}
        />
      </motion.div>
    </div>
  );
}

/** The phone's stand-in for the window: the finished plan as flat cards, with no loop. */
export function PlanCards({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative rounded-xl bg-page p-3 text-[13px] text-fg leading-[18px] shadow-[0_24px_48px_-20px_rgb(23_32_54/0.3),0_0_0_1px_rgb(23_32_54/0.08)]",
        className,
      )}
    >
      <Summary filled={PATH.length} />
      <div className="mt-3">
        <Path filled={PATH.length} />
      </div>
    </div>
  );
}

/** The window's title bar and the app's page tabs with the Planner selected. No logo, since the real header sits right above. */
function Chrome() {
  return (
    <>
      <div className="flex h-8 items-center gap-1.5 bg-[#e8ebf0] px-3.5">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-[#cdd2da]" />
        ))}
      </div>
      <div className="flex h-12 items-center gap-6 border-line border-b bg-bg px-5">
        <span className="-ml-2.5 flex items-center gap-1 text-fg-muted">
          <span className="px-2.5 py-1.5">Browse courses</span>
          <span className="px-2.5 py-1.5">What's next</span>
          <span className="selected px-2.5 py-1.5">Planner</span>
          <span className="px-2.5 py-1.5">Advisor</span>
        </span>
        <span className="ml-auto flex h-8 w-52 items-center gap-2 rounded-md bg-bg px-2.5 text-fg-subtle shadow-button max-[1180px]:w-40">
          <Search className="size-3.5" />
          Search courses
        </span>
      </div>
    </>
  );
}

function Page({ filled }: { filled: number }) {
  return (
    <div className="p-5">
      <Summary filled={filled} />
      <div className="mt-4 grid grid-cols-[13.5rem_minmax(0,1fr)] gap-4">
        <Path filled={filled} />
        <TermCard filled={filled} />
      </div>
    </div>
  );
}

/** "Your plan covers N of 90 credits" over a bar split in the status colors, one slice per term, and the graduation term. */
function Summary({ filled }: { filled: number }) {
  return (
    <div
      className={cn(
        CARD,
        "flex items-center gap-6 px-5 py-3.5 max-md:flex-col max-md:items-stretch max-md:gap-3",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[14px] leading-5">
          Your plan covers{" "}
          <span className="tabular-nums">
            {PATH.slice(0, filled).reduce(
              (sum, term) => sum + termCredits(term),
              0,
            )}
          </span>{" "}
          of {TOTAL} credits
        </p>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line">
          {PATH.map((term, i) => (
            <motion.span
              key={term.offset}
              className={cn(
                "h-full basis-0 origin-left",
                i > 0 &&
                  PATH[i - 1]?.status !== term.status &&
                  "border-bg border-l",
              )}
              style={{
                background: STATUS[term.status].color,
                flexGrow: termCredits(term),
              }}
              initial={false}
              animate={{ scaleX: i < filled ? 1 : 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          ))}
        </div>
      </div>
      <div className="w-36 shrink-0 border-line border-l pl-6 max-md:flex max-md:w-auto max-md:items-center max-md:justify-between max-md:border-t max-md:border-l-0 max-md:pt-3 max-md:pl-0">
        <p className="text-[12px] text-fg-muted leading-4">Graduation</p>
        <p className="mt-0.5 flex items-center gap-1.5 font-semibold max-md:mt-0">
          <GraduationCap className="size-4" strokeWidth={2} />
          {termName(GRADUATION)}
        </p>
      </div>
    </div>
  );
}

const ROW = 44;

/** A piece of the line between two terms, grey until the later term has started and the transcript has filled it, then green. */
function Segment({ top, done }: { top: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-1/2 h-3.5 w-0.5 -translate-x-1/2 bg-fg-subtle/35",
        top ? "top-0" : "bottom-0",
      )}
    >
      <motion.span
        className="absolute inset-0 origin-top bg-completed"
        initial={false}
        animate={{ scaleY: done ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: top ? 0.15 : 0 }}
      />
    </span>
  );
}

/** The classic path: one row per term with its glyph, joined by a line that ends at Graduation. */
function Path({ filled }: { filled: number }) {
  const started = (i: number) => {
    const term = PATH[i];
    return term !== undefined && term.offset <= 0 && i < filled;
  };
  const done = filled === PATH.length;
  return (
    <div className={CARD}>
      <div className={cn(BAND, "py-2.5")}>
        <span className="font-semibold text-[14px]">Your path</span>
      </div>
      <div className="relative p-1.5">
        <motion.div
          className="selected absolute inset-x-1.5 top-1.5"
          style={{ height: ROW }}
          initial={false}
          animate={{
            y: Math.max(0, filled - 1) * ROW,
            opacity: filled ? 1 : 0,
          }}
          transition={{ duration: 0.35, ease: EASE }}
        />
        {PATH.map((term, i) => {
          const on = i < filled;
          return (
            <div
              key={term.offset}
              className="relative flex items-center gap-2.5 px-2"
              style={{ height: ROW }}
            >
              <span className="relative flex h-full w-4 shrink-0 items-center justify-center">
                {i > 0 && <Segment top done={started(i)} />}
                <Segment top={false} done={started(i + 1)} />
                <span className="relative size-4">
                  <motion.span
                    className="absolute inset-0"
                    initial={false}
                    animate={{ opacity: on ? 0 : 1 }}
                  >
                    <StatusIcon status="available" size={16} />
                  </motion.span>
                  <motion.span
                    className="absolute inset-0"
                    initial={false}
                    animate={
                      on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }
                    }
                    transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  >
                    <StatusIcon status={term.status} size={16} />
                  </motion.span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">
                  {termName(term.offset)}
                </span>
                <span className="block truncate text-[12px] text-fg-muted leading-4">
                  {on
                    ? `${term.word} · ${termCredits(term)} credits`
                    : term.offset < 0
                      ? "No courses"
                      : "Nothing planned"}
                </span>
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 px-2" style={{ height: ROW }}>
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center">
            <Segment top done={false} />
            <span className="relative size-4">
              <span className="absolute inset-0 grid place-items-center rounded-full bg-bg text-fg-muted shadow-[inset_0_0_0_1.5px_var(--fg-subtle)]">
                <GraduationCap className="size-2.5" strokeWidth={2.25} />
              </span>
              <motion.span
                className="absolute inset-0 grid place-items-center rounded-full bg-completed text-white"
                initial={false}
                animate={
                  done ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }
                }
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 18,
                  delay: done ? 0.5 : 0,
                }}
              >
                <GraduationCap className="size-2.5" strokeWidth={2.25} />
              </motion.span>
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">Graduation</span>
            <span className="block text-[12px] text-fg-muted leading-4">
              Expected {termName(GRADUATION)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** The selected term: its name, status and credits, then its courses. Empty until the import. */
function TermCard({ filled }: { filled: number }) {
  const term = PATH[filled - 1];
  return (
    <div className={cn(CARD, "flex flex-col")}>
      <div className="flex h-12 items-center gap-3 border-line border-b px-4">
        <span className="font-semibold text-[14px]">
          {term ? termName(term.offset) : "Your courses"}
        </span>
        {term && <StatusBadge status={term.status} />}
        <span className="ml-auto text-fg-muted tabular-nums">
          {term ? termCredits(term) : 0} credits
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {term ? (
          <motion.div
            key={term.offset}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex h-8 items-center justify-between border-line border-b bg-subtle px-4 font-semibold text-[12px]">
              {term.status === "planned" ? "Planned" : "From your transcript"}
              <span className="font-normal text-fg-muted">
                {term.status === "planned"
                  ? "Prerequisites checked"
                  : `${term.courses.length} courses`}
              </span>
            </div>
            {term.courses.map((course, j) => (
              <motion.div
                key={course.code}
                initial={{ opacity: 0, x: -32 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * j, duration: 0.35, ease: EASE }}
              >
                <MockRow
                  glyph={<StatusIcon status={term.status} />}
                  code={course.code}
                  title={course.title}
                >
                  {course.needs?.map((code, k) => (
                    <Check
                      key={code}
                      code={code}
                      on
                      className={k > 1 ? "max-lg:hidden" : undefined}
                      delay={0.35 + 0.05 * j + 0.1 * k}
                    />
                  ))}
                  {course.grade && (
                    <span className="w-6 shrink-0 font-semibold text-fg-muted">
                      {course.grade}
                    </span>
                  )}
                  <span className="w-8 shrink-0 text-right text-fg-muted tabular-nums">
                    {credits(course)} cr
                  </span>
                </MockRow>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid flex-1 place-items-center text-fg-muted"
          >
            Import your transcript to fill in your courses.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
