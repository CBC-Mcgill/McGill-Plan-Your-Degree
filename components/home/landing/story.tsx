"use client";

import { cn } from "cn";
import { GraduationCap } from "lucide-react";
import {
  AnimatePresence,
  type MotionValue,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import {
  type ComponentType,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { CourseCode } from "@/components/course-code";
import { sampleTerm } from "@/components/no-profile";
import { STATUS, StatusIcon } from "@/components/status";
import { BAND, CARD } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import {
  Check,
  GRADUATION,
  MockRow,
  NEXT,
  PATH,
  Sheet,
  TOTAL,
  termCredits,
  termName,
} from "./parts";

const EASE = [0.2, 0.7, 0.2, 1] as const;

type Visual = ComponentType<{ on: boolean }>;

interface Step {
  title: string;
  /** Shown under the headline: what the step does in the app. */
  line: string;
  /** For screen readers: what the visual beside it shows. */
  description: string;
  Visual: Visual;
}

const STEPS: Step[] = [
  {
    title: "Start from your transcript",
    line: "Import the transcript PDF from Minerva. Your courses and grades fill in, and the file never leaves your browser.",
    description:
      "A sample transcript turns into course rows: completed courses with their grades, and this term's courses in progress.",
    Visual: Transcript,
  },
  {
    title: "See what you can take next",
    line: "What's next checks prerequisites for you and shows what you can take next term, what is locked and why.",
    description: `A sample list for ${termName(1)}: two required courses you can take with their prerequisites checked, Numerical Computing not offered that term, and Database Systems locked until you take COMP 302.`,
    Visual: Next,
  },
  {
    title: "Plan every term to graduation",
    line: "The Planner holds every term until graduation and warns you when a course is not offered or comes too early.",
    description: `A sample path: two terms completed, one in progress and three planned, reaching ${TOTAL} credits and graduation in ${termName(GRADUATION)}.`,
    Visual: Path,
  },
];

const HEADLINE =
  "font-display font-bold text-[40px] leading-[46px] tracking-[-0.02em] [font-stretch:112.5%] max-[1180px]:text-[31px] max-[1180px]:leading-9 max-md:text-[26px] max-md:leading-8";

const LINE = "max-w-[34ch] text-[17px] text-fg-muted leading-[26px]";

/** How far either side of a hand-off, in story progress, the outgoing step fades out while the next fades in. */
const H = 0.05;

/** The three sections as one pinned scroll story: the scroll hands each step to the next, its headline and line lighting up as its visual rises into place. With reduced motion, and on phones, three plain sections. */
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
  const { scrollY } = useScroll();
  // Where the pane sticks and how long it stays stuck, in page pixels. Infinity holds progress at 0 until measured.
  const start = useMotionValue(Number.POSITIVE_INFINITY);
  const range = useMotionValue(1);
  const progress = useTransform(() =>
    Math.min(1, Math.max(0, (scrollY.get() - start.get()) / range.get())),
  );
  // The furthest step reached. Its visual builds once, as it starts to fade in, and stays built on the way back.
  const [reached, setReached] = useState(0);
  useMotionValueEvent(progress, "change", (value) =>
    setReached((step) =>
      Math.max(
        step,
        Math.min(STEPS.length - 1, Math.floor((value + H) * STEPS.length)),
      ),
    ),
  );
  // The first visual plays when the story comes into view, not on page load.
  const seen = useInView(pinned, { amount: 0.4, once: true });

  useEffect(() => {
    const section = ref.current;
    const pane = pinned.current;
    if (!section || !pane) return;
    // The body resizes with the window and with anything above the story, which is all that moves the pane.
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(section);
      const before = Number.parseFloat(style.paddingTop);
      const after = Number.parseFloat(style.paddingBottom);
      const top = Number.parseFloat(getComputedStyle(pane).top);
      start.set(
        section.getBoundingClientRect().top + window.scrollY + before - top,
      );
      range.set(section.offsetHeight - before - after - pane.offsetHeight);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [start, range]);

  return (
    <section ref={ref} className="relative h-[300vh] pt-16 pb-16 max-md:hidden">
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
                <Headline
                  key={step.title}
                  step={step}
                  i={i}
                  progress={progress}
                />
              ))}
            </div>
          </div>
          <div aria-hidden className="relative h-[29rem]">
            {STEPS.map(({ title, Visual }, i) => (
              <Slide key={title} i={i} progress={progress}>
                <Visual on={seen && i <= reached} />
              </Slide>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A value scrubbed by the story's progress: `before` until step i hands in, `on` while it shows, `after` once it has handed off. The first step starts on and the last stays on. */
function useStep(
  progress: MotionValue<number>,
  i: number,
  [before, on, after]: [number, number, number],
) {
  const into = i / STEPS.length;
  const out = (i + 1) / STEPS.length;
  const first = i === 0;
  const last = i === STEPS.length - 1;
  return useTransform(
    progress,
    [
      ...(first ? [] : [into - H, into + H]),
      ...(last ? [] : [out - H, out + H]),
    ],
    [...(first ? [] : [before, on]), ...(last ? [] : [on, after])],
  );
}

/** A headline, half lit unless its step shows, with its line opening under it. */
function Headline({
  step,
  i,
  progress,
}: {
  step: Step;
  i: number;
  progress: MotionValue<number>;
}) {
  const shown = useStep(progress, i, [0, 1, 0]);
  const opacity = useTransform(shown, [0, 1], [0.5, 1]);
  const rows = useTransform(shown, (value) => `${value}fr`);
  return (
    <motion.div style={{ opacity }}>
      <h2 className={HEADLINE}>{step.title}</h2>
      <motion.div
        className="grid"
        style={{ gridTemplateRows: rows, opacity: shown }}
      >
        <div className="overflow-hidden">
          <p className={cn(LINE, "pt-3")}>{step.line}</p>
        </div>
      </motion.div>
      <p className="sr-only">{step.description}</p>
    </motion.div>
  );
}

/** A visual that rises in and lifts out with the scroll, on whole pixels so its text stays sharp. */
function Slide({
  i,
  progress,
  children,
}: {
  i: number;
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const opacity = useStep(progress, i, [0, 1, 0]);
  const lift = useStep(progress, i, [24, 0, -24]);
  const y = useTransform(lift, Math.round);
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      style={{ opacity, y }}
    >
      {children}
    </motion.div>
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
        {STEPS.map(({ title, line, description, Visual }) => (
          <section
            key={title}
            className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 max-[1180px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] max-[1180px]:gap-12 max-md:grid-cols-1 max-md:gap-5"
          >
            <div>
              <h2 className={HEADLINE}>{title}</h2>
              <p className={cn(LINE, "mt-3")}>{line}</p>
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

/** What the transcript holds, the first three courses of each term: the two terms done and this one in progress. */
const READ = PATH.slice(0, 3).map((term) => ({
  term,
  courses: term.courses.slice(0, 3),
}));
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
          "absolute top-1/2 right-0 flex h-[27rem] w-[calc(100%-10.5rem)] -translate-y-1/2 flex-col overflow-hidden max-[1180px]:w-[calc(100%-7.5rem)] max-md:static max-md:w-full max-md:translate-y-0",
        )}
      >
        <div className={BAND}>
          <span className="font-semibold">Sample transcript</span>
          <span className="ml-auto text-fg-muted">Computer Science major</span>
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
                      delay: on ? 0.05 + i * 0.035 : 0,
                      duration: 0.35,
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

const NEXT_STARTS = NEXT.map((_, g) =>
  NEXT.slice(0, g).reduce((sum, group) => sum + group.courses.length, 0),
);

function Next({ on }: { on: boolean }) {
  const season = sampleTerm(1).season;
  return (
    <div
      className={cn(
        CARD,
        "flex h-[27rem] w-full flex-col overflow-hidden max-md:h-auto",
      )}
    >
      <div className={BAND}>
        <span className="font-semibold">What's next for {termName(1)}</span>
        <span className="ml-auto text-fg-muted max-md:hidden">
          Prerequisites checked
        </span>
      </div>
      {NEXT.map((group, g) => (
        <Fragment key={group.title}>
          <div className="flex h-8 items-center gap-2 border-line border-b bg-subtle px-5 font-semibold text-[13px]">
            {group.title}
            <span className="ml-auto font-normal text-fg-muted tabular-nums">
              {COPY.fraction(group.done, group.total)}
            </span>
          </div>
          {group.courses.map((course, n) => {
            const offered = course.offered !== false;
            const status = offered && !course.missing ? "available" : "locked";
            const word = offered
              ? STATUS[status].label
              : COPY.notOfferedIn(season);
            const at = ((NEXT_STARTS[g] ?? 0) + n) * 0.06;
            return (
              <motion.div
                key={course.code}
                className="flex flex-1 flex-col justify-center border-line border-b py-1.5 last:border-b-0"
                initial={{ opacity: 0, y: 12 }}
                animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ delay: on ? at : 0, duration: 0.3, ease: EASE }}
              >
                <MockRow
                  glyph={<StatusIcon status={status} />}
                  code={course.code}
                  title={course.title}
                  className={cn(
                    "h-8 px-5",
                    status === "locked" && "text-fg-muted",
                  )}
                >
                  {/* On phones a long word moves under the title, so the title still fits. */}
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      !offered && "max-md:hidden",
                    )}
                    style={{ color: STATUS[status].text }}
                  >
                    {word}
                  </span>
                </MockRow>
                {offered ? (
                  <div className="flex flex-wrap gap-1.5 pb-2 pl-[2.875rem]">
                    {course.checks.map((code) => (
                      <Check
                        key={code}
                        code={code}
                        on={on}
                        delay={on ? at + 0.2 : 0}
                      />
                    ))}
                    {course.missing && (
                      <motion.span
                        className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] bg-tint pr-1.5 pl-1 font-medium text-[12px] text-fg-muted leading-none"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={
                          on
                            ? { opacity: 1, scale: 1 }
                            : { opacity: 0, scale: 0.8 }
                        }
                        transition={{
                          delay: on ? at + 0.2 : 0,
                          duration: 0.3,
                          ease: EASE,
                        }}
                      >
                        <StatusIcon status="locked" size={12} />
                        {COPY.needs(course.missing)}
                      </motion.span>
                    )}
                  </div>
                ) : (
                  <span className="pb-2 pl-[2.875rem] font-medium text-[12px] text-fg-muted leading-5 md:hidden">
                    {word}
                  </span>
                )}
              </motion.div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function Path({ on }: { on: boolean }) {
  const last = PATH.length;
  return (
    <div
      className={cn(
        CARD,
        "flex h-[27rem] w-full flex-col overflow-hidden max-md:h-auto",
      )}
    >
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
              delay: on ? i * 0.06 : 0,
              duration: 0.3,
              ease: EASE,
            }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col px-2 py-2">
        {PATH.map((term, i) => (
          <motion.div
            key={term.offset}
            className="flex min-h-11 flex-1 items-center gap-2.5 px-2 py-1 max-[1180px]:gap-2 max-md:grid max-md:grid-cols-[1rem_minmax(0,1fr)] max-md:gap-y-1.5 max-md:py-2"
            initial={{ opacity: 0, x: -16 }}
            animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
            transition={{
              delay: on ? i * 0.06 : 0,
              duration: 0.3,
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
        <div className="flex min-h-11 flex-1 items-center gap-2.5 px-2 max-[1180px]:gap-2 max-md:items-start max-md:py-2">
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center max-md:-my-2 max-md:h-auto max-md:items-start max-md:self-stretch max-md:pt-2.5">
            <Line top done={false} />
            <motion.span
              className="relative grid size-4 place-items-center rounded-full bg-completed text-white"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={
                on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }
              }
              transition={{
                delay: on ? last * 0.06 : 0,
                type: "spring",
                stiffness: 500,
                damping: 28,
              }}
            >
              <GraduationCap className="size-2.5" strokeWidth={2.25} />
            </motion.span>
          </span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ delay: on ? last * 0.06 : 0 }}
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
