"use client";

import { cn } from "cn";
import { GraduationCap } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
} from "motion/react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { CourseCode } from "@/components/course-code";
import { STATUS, StatusIcon } from "@/components/status";
import { BAND, CARD } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import {
  Check,
  GRADUATION,
  MockRow,
  PATH,
  Sheet,
  TOTAL,
  termCredits,
  termName,
} from "./parts";

const EASE = [0.2, 0.7, 0.2, 1] as const;

type Visual = ComponentType<{ on: boolean }>;

const STEPS: { title: string; description: string; Visual: Visual }[] = [
  {
    title: "Start from your transcript",
    description:
      "A sample transcript turns into course rows: completed courses with their grades, and this term's courses in progress.",
    Visual: Transcript,
  },
  {
    title: "See what you can take next",
    description: `A sample list for ${termName(1)}: three courses you can take with their prerequisites checked, and Database Systems locked until you take COMP 302.`,
    Visual: Next,
  },
  {
    title: "Plan every term to graduation",
    description: `A sample path: two terms completed, one in progress and three planned, reaching ${TOTAL} credits and graduation in ${termName(GRADUATION)}.`,
    Visual: Path,
  },
];

const HEADLINE =
  "font-display font-bold text-[40px] leading-[46px] tracking-[-0.02em] [font-stretch:112.5%] max-[1180px]:text-[31px] max-[1180px]:leading-9 max-md:text-[26px] max-md:leading-8";

/** The three sections as one pinned scroll story: the headlines on the left light up in turn while the visual on the right morphs. With reduced motion, and on phones, three plain sections. */
export function Story({ reduce }: { reduce: boolean }) {
  return reduce ? (
    <Stacked />
  ) : (
    <>
      <Pinned />
      <Stacked className="md:hidden" />
    </>
  );
}

function Pinned() {
  const ref = useRef<HTMLElement>(null);
  const pinned = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const [active, setActive] = useState(0);
  // The first visual plays when the story comes into view, not on page load.
  const seen = useInView(pinned, { amount: 0.4, once: true });

  // Progress runs from the pane sticking to it letting go, so each step gets a third of the pinned scroll.
  useEffect(() => {
    const update = () => {
      const section = ref.current;
      const pane = pinned.current;
      if (!section || !pane) return;
      const style = getComputedStyle(section);
      const before = Number.parseFloat(style.paddingTop);
      const after = Number.parseFloat(style.paddingBottom);
      const top = Number.parseFloat(getComputedStyle(pane).top);
      const box = section.getBoundingClientRect();
      const range = box.height - before - after - pane.offsetHeight;
      const value = Math.min(1, Math.max(0, (top - box.top - before) / range));
      progress.set(value);
      setActive(Math.min(STEPS.length - 1, Math.floor(value * STEPS.length)));
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
    };
  }, [progress]);

  return (
    <section ref={ref} className="relative h-[240vh] pt-16 pb-16 max-md:hidden">
      {/* A 31rem pane centered in the space under the header. */}
      <div
        ref={pinned}
        className="sticky top-[max(4rem,calc(50vh+2rem-15.5rem))] flex h-[31rem] items-center"
      >
        <div className="mx-auto grid w-full max-w-page grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 max-[1180px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] max-[1180px]:gap-12 px-8">
          <div className="relative pl-9">
            <span className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-fg/10">
              <motion.span
                className="absolute inset-0 origin-top rounded-full bg-fg"
                style={{ scaleY: progress }}
              />
            </span>
            <div className="flex flex-col gap-10">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={false}
                  animate={{ opacity: active === i ? 1 : 0.5 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className={HEADLINE}>{step.title}</h2>
                  <p className="sr-only">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <div aria-hidden className="relative h-[29rem]">
            {STEPS.map(({ title, Visual }, i) => (
              <motion.div
                key={title}
                className="absolute inset-0 flex items-center"
                initial={false}
                animate={{
                  opacity: active === i ? 1 : 0,
                  y: active === i ? 0 : active > i ? -28 : 28,
                  scale: active === i ? 1 : 0.97,
                }}
                transition={
                  active === i
                    ? { duration: 0.45, delay: 0.1, ease: EASE }
                    : { duration: 0.25, ease: EASE }
                }
              >
                <Visual on={seen && active === i} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stacked({ className }: { className?: string }) {
  return (
    // initial={false} renders every visual straight in its finished frame.
    <AnimatePresence initial={false}>
      <div
        key="still"
        className={cn(
          "mx-auto flex w-full max-w-page flex-col gap-24 px-8 py-24 max-md:gap-16 max-md:px-4 max-md:pt-0 max-md:pb-8",
          className,
        )}
      >
        {STEPS.map(({ title, description, Visual }) => (
          <section
            key={title}
            className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 max-[1180px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] max-[1180px]:gap-12 max-md:grid-cols-1 max-md:gap-5"
          >
            <div>
              <h2 className={HEADLINE}>{title}</h2>
              <p className="sr-only">{description}</p>
            </div>
            <div
              aria-hidden
              className="relative flex h-[29rem] items-center max-md:h-auto"
            >
              <Visual on />
            </div>
          </section>
        ))}
      </div>
    </AnimatePresence>
  );
}

/** What the transcript holds: the two terms done and this one in progress. */
const READ = PATH.slice(0, 3).map((term) => ({
  term,
  courses: term.courses,
}));
const READ_COUNT = READ.reduce((sum, group) => sum + group.courses.length, 0);
const READ_STARTS = READ.map((_, g) =>
  READ.slice(0, g).reduce((sum, group) => sum + group.courses.length, 0),
);

function Transcript({ on }: { on: boolean }) {
  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute top-1/2 left-0 w-[12.5rem] -translate-y-1/2 max-md:hidden"
        initial={false}
        animate={{ rotate: on ? -6 : -2, x: on ? 0 : 40 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Sheet
          lines={READ.map((group) => group.courses.map((c) => c.code))}
          lit={on}
        />
      </motion.div>
      <div
        className={cn(
          CARD,
          "absolute top-1/2 right-0 flex h-[27rem] w-[calc(100%-10.5rem)] -translate-y-1/2 flex-col overflow-hidden max-[1180px]:w-[calc(100%-7.5rem)] max-md:static max-md:h-[22rem] max-md:w-full max-md:translate-y-0",
        )}
      >
        <div className={BAND}>
          <span className="font-semibold">From your transcript</span>
          <span className="ml-auto text-fg-muted">{READ_COUNT} courses</span>
        </div>
        <div className="min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
          {READ.map(({ term, courses }, g) => (
            <div key={term.offset}>
              <div className="flex h-8 items-center gap-2 border-line border-b bg-subtle px-4 font-semibold text-[13px] [&:not(:first-child)]:border-t">
                {termName(term.offset)}
                <span
                  className="font-normal"
                  style={{ color: STATUS[term.status].text }}
                >
                  {STATUS[term.status].label}
                </span>
              </div>
              {courses.map((course, n) => {
                const i = (READ_STARTS[g] ?? 0) + n;
                return (
                  <motion.div
                    key={course.code}
                    initial={{ opacity: 0, x: -96 }}
                    animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -96 }}
                    transition={{
                      delay: on ? 0.15 + i * 0.09 : 0,
                      duration: 0.45,
                      ease: EASE,
                    }}
                  >
                    <MockRow
                      glyph={<StatusIcon status={term.status} />}
                      code={course.code}
                      title={course.title}
                      className="h-8"
                    >
                      {course.grade && (
                        <span className="w-6 shrink-0 text-right font-semibold text-fg-muted">
                          {course.grade}
                        </span>
                      )}
                    </MockRow>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NEXT: {
  code: string;
  title: string;
  checks: string[];
  missing?: string;
}[] = [
  {
    code: "COMP 302",
    title: "Programming Languages and Paradigms",
    checks: ["COMP 250", "MATH 240"],
  },
  {
    code: "COMP 303",
    title: "Software Design",
    checks: ["COMP 206", "COMP 250"],
  },
  { code: "MATH 340", title: "Discrete Mathematics", checks: ["MATH 240"] },
  {
    code: "COMP 421",
    title: "Database Systems",
    checks: ["COMP 206"],
    missing: "COMP 302",
  },
];

function Next({ on }: { on: boolean }) {
  return (
    <div className={cn(CARD, "w-full overflow-hidden")}>
      <div className={BAND}>
        <span className="font-semibold">What's next for {termName(1)}</span>
        <span className="ml-auto text-fg-muted max-md:hidden">
          Prerequisites checked
        </span>
      </div>
      {NEXT.map((course, i) => {
        const status = course.missing ? "locked" : "available";
        const at = 0.1 + i * 0.12;
        return (
          <motion.div
            key={course.code}
            className="border-line border-t py-1.5 first:border-t-0"
            initial={{ opacity: 0, y: 12 }}
            animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ delay: on ? at : 0, duration: 0.4, ease: EASE }}
          >
            <MockRow
              glyph={<StatusIcon status={status} />}
              code={course.code}
              title={course.title}
              className={cn("h-8 px-5", course.missing && "text-fg-muted")}
            >
              <span
                className="shrink-0 font-medium"
                style={{ color: STATUS[status].text }}
              >
                {STATUS[status].label}
              </span>
            </MockRow>
            <div className="flex gap-1.5 pb-2 pl-[2.875rem]">
              {course.checks.map((code, k) => (
                <Check
                  key={code}
                  code={code}
                  on={on}
                  delay={on ? at + 0.35 + k * 0.15 : 0}
                />
              ))}
              {course.missing && (
                <motion.span
                  className="inline-flex h-5 items-center gap-1 rounded-[5px] bg-tint pr-1.5 pl-1 font-medium text-[12px] text-fg-muted leading-none"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={
                    on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
                  }
                  transition={{
                    delay: on ? at + 0.65 : 0,
                    duration: 0.3,
                    ease: EASE,
                  }}
                >
                  <StatusIcon status="locked" size={12} />
                  {COPY.needs(course.missing)}
                </motion.span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Path({ on }: { on: boolean }) {
  const last = PATH.length;
  return (
    <div className={cn(CARD, "w-full overflow-hidden")}>
      <div className={BAND}>
        <span className="font-semibold">Your path to graduation</span>
        <span className="ml-auto text-fg-muted tabular-nums">
          {TOTAL} of {TOTAL} credits
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden bg-line">
        {PATH.map((term, i) => (
          <motion.span
            key={term.offset}
            className={cn(
              "h-full flex-1 origin-left",
              i > 0 &&
                PATH[i - 1]?.status !== term.status &&
                "border-bg border-l",
            )}
            style={{ background: STATUS[term.status].color }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: on ? 1 : 0 }}
            transition={{
              delay: on ? 0.15 + i * 0.12 : 0,
              duration: 0.35,
              ease: EASE,
            }}
          />
        ))}
      </div>
      <div className="px-2 py-2">
        {PATH.map((term, i) => (
          <motion.div
            key={term.offset}
            className="flex min-h-11 items-center gap-2.5 px-2 py-1 max-[1180px]:gap-2 max-md:grid max-md:grid-cols-[1rem_minmax(0,1fr)] max-md:gap-y-1.5 max-md:py-2"
            initial={{ opacity: 0, x: -16 }}
            animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
            transition={{
              delay: on ? 0.15 + i * 0.12 : 0,
              duration: 0.4,
              ease: EASE,
            }}
          >
            <span className="relative -my-1 flex w-4 shrink-0 items-center justify-center self-stretch max-md:row-span-2 max-md:-my-2 max-md:items-start max-md:pt-2.5">
              {i > 0 && <Line top done={term.offset <= 0} />}
              <Line top={false} done={(PATH[i + 1]?.offset ?? 1) <= 0} />
              <StatusIcon status={term.status} size={16} />
            </span>
            <span className="w-36 shrink-0 whitespace-nowrap">
              <span className="block font-semibold">
                {termName(term.offset)}
              </span>
              <span className="block text-[12px] text-fg-muted leading-4">
                {term.word} · {termCredits(term)} credits
              </span>
            </span>
            <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 font-semibold text-[13px] max-[1180px]:gap-x-2 max-[1180px]:text-[12px]">
              {term.courses.map((course) => (
                <CourseCode key={course.code} code={course.code} />
              ))}
            </span>
          </motion.div>
        ))}
        <div className="flex h-11 items-center gap-2.5 px-2 max-[1180px]:gap-2 max-md:h-auto max-md:items-start max-md:py-2">
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center max-md:-my-2 max-md:h-auto max-md:items-start max-md:self-stretch max-md:pt-2.5">
            <Line top done={false} />
            <motion.span
              className="relative grid size-4 place-items-center rounded-full bg-completed text-white"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={
                on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }
              }
              transition={{
                delay: on ? 0.2 + last * 0.12 : 0,
                type: "spring",
                stiffness: 380,
                damping: 16,
              }}
            >
              <GraduationCap className="size-2.5" strokeWidth={2.25} />
            </motion.span>
          </span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ delay: on ? 0.2 + last * 0.12 : 0 }}
          >
            <span className="block font-semibold">Graduation</span>
            <span className="block text-[12px] text-fg-muted leading-4">
              Expected {termName(GRADUATION)}
            </span>
          </motion.span>
        </div>
      </div>
    </div>
  );
}

function Line({ top, done }: { top: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-1/2 h-[calc(50%-0.5rem)] w-0.5 -translate-x-1/2",
        // On phones the icon sits 10px down, beside the term's name.
        top ? "top-0 max-md:h-2.5" : "bottom-0 max-md:top-6.5 max-md:h-auto",
        done ? "bg-completed" : "bg-fg-subtle/35",
      )}
    />
  );
}
