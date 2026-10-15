"use client";

import { cn } from "cn";
import { GraduationCap } from "lucide-react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { type ComponentType, type ReactNode, useEffect, useRef } from "react";
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
  type NextCourse,
  PATH,
  Sheet,
  TOTAL,
  termCredits,
  termName,
} from "./parts";

/** A visual drawn as far as `progress` says, from 0 empty to 1 built. */
type Visual = ComponentType<{ progress: MotionValue<number> }>;

const STEPS: {
  title: string;
  line: string;
  description: string;
  Visual: Visual;
}[] = [
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
    description: `A sample What's next for ${termName(1)}: two required courses you can take with their prerequisites checked, Numerical Computing not offered in ${sampleTerm(1).season}, and Database Systems locked until you take COMP 302.`,
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

/** Each step's third of the pinned scroll, in steps: it builds over the first half, holds, then hands off to the next over the last fifth. */
const BUILD = 0.5;
const HANDOFF = 0.2;

/** Where step i is on, as progress: it comes in over the hand-off before it and leaves over the one after. The last step stays. */
const onRange = (i: number) => {
  const out = i < STEPS.length - 1 ? i + 1 - HANDOFF : STEPS.length + 1;
  return [i - HANDOFF, i, out, out + HANDOFF].map((t) => t / STEPS.length);
};

/** How long one part takes to come in, as a share of its visual's build. */
const SPAN = 0.2;

/** One part's slice of a build: over [at, at + span] of `progress`, `shown` runs from 0 to 1 and `x` from `from` px to 0. */
function useReveal(
  progress: MotionValue<number>,
  at: number,
  span = SPAN,
  from = 0,
) {
  const shown = useTransform(progress, [at, at + span], [0, 1]);
  // Whole pixels, so text that stops mid-slide stays sharp.
  const x = useTransform(shown, (value) => Math.round((1 - value) * from));
  return { shown, x };
}

/** One part of a build: it fades in over its slice of `progress` while sliding in from `from` px. */
function Reveal({
  progress,
  at,
  span,
  from,
  className,
  children,
}: {
  progress: MotionValue<number>;
  at: number;
  span?: number;
  from?: number;
  className?: string;
  children: ReactNode;
}) {
  const { shown, x } = useReveal(progress, at, span, from);
  return (
    <motion.div className={className} style={{ opacity: shown, x }}>
      {children}
    </motion.div>
  );
}

/** The three sections as one pinned scroll story: the headlines on the left light up in turn while the visual on the right builds with the scroll, so it stops when the scroll stops and runs back when it does. With reduced motion, and on phones, three plain sections. */
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
  const start = useMotionValue(0);
  const range = useMotionValue(1);
  // Progress runs from the pane sticking to it letting go, so each step gets a third of the pinned scroll.
  const progress = useTransform(() =>
    Math.min(1, Math.max(0, (scrollY.get() - start.get()) / range.get())),
  );

  // Measured when a size changes, so a scroll reads no layout.
  useEffect(() => {
    const section = ref.current;
    const pane = pinned.current;
    if (!section || !pane) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(section);
      const before = Number.parseFloat(style.paddingTop);
      const after = Number.parseFloat(style.paddingBottom);
      const top = Number.parseFloat(getComputedStyle(pane).top);
      start.set(
        section.getBoundingClientRect().top + window.scrollY + before - top,
      );
      range.set(
        Math.max(1, section.offsetHeight - before - after - pane.offsetHeight),
      );
    });
    observer.observe(section);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [start, range]);

  return (
    <section ref={ref} className="relative h-[340vh] pt-16 pb-16 max-md:hidden">
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
            {STEPS.map((step, i) => (
              <Slide
                key={step.title}
                Visual={step.Visual}
                i={i}
                progress={progress}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A step's headline, full strength while its step is on, with its line open under it. */
function Headline({
  step,
  i,
  progress,
}: {
  step: (typeof STEPS)[number];
  i: number;
  progress: MotionValue<number>;
}) {
  const on = useTransform(progress, onRange(i), [0, 1, 1, 0]);
  const opacity = useTransform(on, [0, 1], [0.5, 1]);
  const rows = useTransform(on, [0, 1], ["0fr", "1fr"]);
  return (
    <motion.div style={{ opacity }}>
      <h2 className={HEADLINE}>{step.title}</h2>
      <motion.div className="grid" style={{ gridTemplateRows: rows }}>
        <motion.p
          className={cn(LINE, "min-h-0 overflow-hidden pt-3")}
          style={{ opacity: on }}
        >
          {step.line}
        </motion.p>
      </motion.div>
      <p className="sr-only">{step.description}</p>
    </motion.div>
  );
}

/** A step's visual: it rises in over the hand-off before it, builds, holds, then lifts away over the hand-off after it. */
function Slide({
  Visual,
  i,
  progress,
}: {
  Visual: Visual;
  i: number;
  progress: MotionValue<number>;
}) {
  const on = useTransform(progress, onRange(i), [0, 1, 1, 0]);
  const lift = useTransform(progress, onRange(i), [24, 0, 0, -24]);
  const y = useTransform(lift, Math.round);
  const built = useTransform(
    progress,
    [i / STEPS.length, (i + BUILD) / STEPS.length],
    [0, 1],
  );
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      style={{ opacity: on, y }}
    >
      <Visual progress={built} />
    </motion.div>
  );
}

function Stacked({ className }: { className?: string }) {
  const built = useMotionValue(1);
  return (
    <div
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
            <Visual progress={built} />
          </div>
        </section>
      ))}
    </div>
  );
}

/** Where each group's first course falls among all of them. */
const starts = (groups: { courses: unknown[] }[]) =>
  groups.map((_, g) =>
    groups.slice(0, g).reduce((sum, group) => sum + group.courses.length, 0),
  );

/** What the transcript holds: the first three courses of the two terms done and of this one in progress. */
const READ = PATH.slice(0, 3).map((term) => ({
  term,
  courses: term.courses.slice(0, 3),
}));
const READ_COUNT = READ.reduce((sum, group) => sum + group.courses.length, 0);
const READ_STARTS = starts(READ);
/** The rows come in one after another once the sheet has landed. */
const ROW_GAP = (0.9 - SPAN) / (READ_COUNT - 1);
const rowAt = (i: number) => 0.1 + i * ROW_GAP;

function Transcript({ progress }: { progress: MotionValue<number> }) {
  const rotate = useTransform(progress, [0, 0.15], [-2, -6]);
  const slide = useTransform(progress, [0, 0.15], [40, 0]);
  const x = useTransform(slide, Math.round);
  const lit = useTransform(
    progress,
    [rowAt(0), rowAt(READ_COUNT + 1)],
    [0, READ_COUNT + 1],
  );
  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute top-1/2 left-0 w-[12.5rem] -translate-y-1/2 max-md:hidden"
        style={{ rotate, x }}
      >
        <Sheet
          lines={READ.map((group) => group.courses.map((c) => c.code))}
          lit={lit}
        />
      </motion.div>
      <div
        className={cn(
          CARD,
          "absolute top-1/2 right-0 flex h-[27rem] w-[calc(100%-10.5rem)] -translate-y-1/2 flex-col overflow-hidden max-[1180px]:w-[calc(100%-7.5rem)] max-md:static max-md:h-[26rem] max-md:w-full max-md:translate-y-0",
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
              {courses.map((course, n) => (
                <Reveal
                  key={course.code}
                  progress={progress}
                  at={rowAt((READ_STARTS[g] ?? 0) + n)}
                  from={-96}
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
                </Reveal>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NEXT_STARTS = starts(NEXT);
/** Each row of What's next comes in a fifth of the build after the one before, its chips after it. */
const NEXT_GAP = 0.2;
const CHIP = 0.12;
const chipAt = (row: number, k: number) => row + 0.1 + k * 0.06;

function Next({ progress }: { progress: MotionValue<number> }) {
  return (
    <div className={cn(CARD, "w-full overflow-hidden")}>
      <div className={BAND}>
        <span className="font-semibold">What's next for {termName(1)}</span>
        <span className="ml-auto text-fg-muted max-md:hidden">
          Prerequisites checked
        </span>
      </div>
      {NEXT.map((group, g) => (
        <div key={group.title}>
          <div
            className={cn(
              "flex h-8 items-center gap-2 border-line border-b bg-subtle px-5 font-semibold text-[13px]",
              g > 0 && "border-t",
            )}
          >
            {group.title}
            <span className="ml-auto font-normal text-fg-muted tabular-nums">
              {COPY.fraction(group.done, group.total)}
            </span>
          </div>
          {group.courses.map((course, n) => (
            <NextRow
              key={course.code}
              course={course}
              at={((NEXT_STARTS[g] ?? 0) + n) * NEXT_GAP}
              progress={progress}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function NextRow({
  course,
  at,
  progress,
}: {
  course: NextCourse;
  at: number;
  progress: MotionValue<number>;
}) {
  const open = !course.missing && course.offered !== false;
  const status = open ? "available" : "locked";
  const word =
    course.offered === false
      ? COPY.notOfferedIn(sampleTerm(1).season)
      : STATUS[status].label;
  return (
    <Reveal
      progress={progress}
      at={at}
      from={-16}
      className="border-line border-b py-1.5 last:border-b-0"
    >
      <MockRow
        glyph={<StatusIcon status={status} />}
        code={course.code}
        title={course.title}
        className={cn("h-8 px-5", !open && "text-fg-muted")}
      >
        <span
          className={cn(
            "shrink-0 font-medium",
            course.offered === false && "max-md:hidden",
          )}
          style={{ color: STATUS[status].text }}
        >
          {word}
        </span>
      </MockRow>
      {/* On a phone a long reason goes under the title, as on /next, so the title still fits. */}
      {course.offered === false && (
        <div className="pb-2 pl-[2.875rem] font-medium text-[12px] text-fg-muted md:hidden">
          {word}
        </div>
      )}
      {(course.checks.length > 0 || course.missing) && (
        <div className="flex flex-wrap gap-1.5 pb-2 pl-[2.875rem]">
          {course.checks.map((code, k) => (
            <Chip
              key={code}
              code={code}
              at={chipAt(at, k)}
              progress={progress}
            />
          ))}
          {course.missing && (
            <Reveal
              progress={progress}
              at={chipAt(at, course.checks.length)}
              span={CHIP}
              from={-6}
              className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] bg-tint pr-1.5 pl-1 font-medium text-[12px] text-fg-muted leading-none"
            >
              <StatusIcon status="locked" size={12} />
              {COPY.needs(course.missing)}
            </Reveal>
          )}
        </div>
      )}
    </Reveal>
  );
}

/** A met prerequisite whose tick draws once the chip is half in. */
function Chip({
  code,
  at,
  progress,
}: {
  code: string;
  at: number;
  progress: MotionValue<number>;
}) {
  const { shown, x } = useReveal(progress, at, CHIP, -6);
  const tick = useReveal(progress, at + CHIP / 2, CHIP).shown;
  return <Check code={code} scrub={{ opacity: shown, x, tick }} />;
}

/** Each term of the path comes in a little after the one before, with its share of the credits bar. */
const TERM_GAP = 0.12;
/** When the graduation cap pops, as a share of the path's build. */
const GRADUATE = 0.8;

function Path({ progress }: { progress: MotionValue<number> }) {
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
          <Fill
            key={term.offset}
            progress={progress}
            at={i * TERM_GAP}
            color={STATUS[term.status].color}
            className={cn(
              i > 0 &&
                PATH[i - 1]?.status !== term.status &&
                "border-bg border-l",
            )}
          />
        ))}
      </div>
      <div className="px-2 py-2">
        {PATH.map((term, i) => (
          <Reveal
            key={term.offset}
            progress={progress}
            at={i * TERM_GAP}
            from={-16}
            className="flex min-h-11 items-center gap-2.5 px-2 py-1 max-[1180px]:gap-2 max-md:grid max-md:grid-cols-[1rem_minmax(0,1fr)] max-md:gap-y-1.5 max-md:py-2"
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
          </Reveal>
        ))}
        <div className="flex h-11 items-center gap-2.5 px-2 max-[1180px]:gap-2 max-md:h-auto max-md:items-start max-md:py-2">
          <span className="relative flex h-full w-4 shrink-0 items-center justify-center max-md:-my-2 max-md:h-auto max-md:items-start max-md:self-stretch max-md:pt-2.5">
            <Line top done={false} />
            <Cap progress={progress} />
          </span>
          <Reveal progress={progress} at={GRADUATE - 0.05}>
            <span className="block font-semibold">Graduation</span>
            <span className="block text-[12px] text-fg-muted leading-4">
              Expected {termName(GRADUATION)}
            </span>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** A term's share of the credits bar, filling from the left over its slice. */
function Fill({
  progress,
  at,
  color,
  className,
}: {
  progress: MotionValue<number>;
  at: number;
  color: string;
  className?: string;
}) {
  const { shown } = useReveal(progress, at);
  return (
    <motion.span
      className={cn("h-full flex-1 origin-left", className)}
      style={{ background: color, scaleX: shown }}
    />
  );
}

/** The graduation cap, the story's one timed piece: it pops on a spring once the build reaches it and stays when the scroll runs back. */
function Cap({ progress }: { progress: MotionValue<number> }) {
  const reached = useMotionValue(progress.get() >= GRADUATE ? 1 : 0);
  useMotionValueEvent(progress, "change", (value) => {
    if (value >= GRADUATE) reached.set(1);
  });
  const pop = useSpring(reached, { stiffness: 380, damping: 16 });
  const scale = useTransform(pop, [0, 1], [0.3, 1], { clamp: false });
  const opacity = useTransform(pop, [0, 1], [0, 1]);
  return (
    <motion.span
      className="relative grid size-4 place-items-center rounded-full bg-completed text-white"
      style={{ opacity, scale }}
    >
      <GraduationCap className="size-2.5" strokeWidth={2.25} />
    </motion.span>
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
