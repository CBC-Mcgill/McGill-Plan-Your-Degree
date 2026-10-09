"use client";

import { ArrowUpRight, Gift, ShieldCheck, Star } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import { REPO_URL } from "@/lib/github";
import { startProfile } from "@/lib/profile/started";
import { useReduce } from "./landing/parts";
import { Story } from "./landing/story";
import { PlannerWindow } from "./landing/window";

/** The calls to action as glass on the paper, see `.glass` and `.glass-red` in globals.css. */
const GLASS_BUTTON = "glass h-12 rounded-[10px] px-6 text-[15px] text-fg";

/** The landing for first-time visitors: a centered headline over the planner in 3D that flattens as you scroll, a pinned scroll story, then one last call to action. */
export function Landing({ stars }: { stars: number | null }) {
  const reduce = useReduce();
  return (
    <div className="paper">
      <Hero reduce={reduce} stars={stars} />
      <Story reduce={reduce} />
      <FinalCall stars={stars} />
    </div>
  );
}

function Hero({ reduce, stars }: { reduce: boolean; stars: number | null }) {
  const hero = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stage,
    offset: ["start start", "end start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 0.4], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.95, 1]);
  const y = useTransform(scrollYProgress, [0, 0.4], [-40, 0]);
  // The text fades before it slides under the see-through header.
  const { scrollY } = useScroll();
  const titleOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const actionsOpacity = useTransform(scrollY, [180, 340], [1, 0]);

  return (
    <div ref={stage} className="relative overflow-hidden">
      <section
        ref={hero}
        className="relative z-10 px-8 pt-10 pb-10 text-center"
      >
        <motion.div style={{ opacity: titleOpacity }}>
          <h1 className="mx-auto mt-6 max-w-[19ch] text-[clamp(3.25rem,5.6vw,4.75rem)] leading-[0.98] tracking-[-0.03em]">
            Plan your whole <span className="mcgill-flow">McGill</span> degree
            in one tab
          </h1>
          <p className="mt-5 text-fg-muted text-lg">
            No spreadsheet, no notes doc, no dozen open tabs.
          </p>
        </motion.div>
        <motion.div style={{ opacity: actionsOpacity }}>
          <div className="mt-7 flex justify-center gap-3">
            <Button asChild className={`glass-red ${GLASS_BUTTON} text-white`}>
              <Link href="/profile">{COPY.importTranscript}</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={startProfile}
              className={GLASS_BUTTON}
            >
              {COPY.startWithout}
            </Button>
          </div>
          <Facts stars={stars} className="mt-6" />
        </motion.div>
      </section>
      <div className="relative mx-auto max-w-page px-8 pb-28 [perspective:1600px]">
        <p className="sr-only">
          A sample planner: a transcript drops in, past terms fill with
          completed courses, the next terms fill with planned courses whose
          prerequisites are checked, and the credits bar fills to graduation.
        </p>
        <div
          aria-hidden
          className="absolute inset-x-0 top-[30%] bottom-0 bg-[radial-gradient(closest-side_at_36%_62%,rgb(218_26_46/0.14),transparent),radial-gradient(closest-side_at_64%_56%,rgb(139_124_235/0.16),transparent)]"
        />
        <motion.div
          aria-hidden
          className="mx-auto max-w-[68rem] will-change-transform"
          style={reduce ? undefined : { rotateX, scale, y }}
        >
          <PlannerWindow reduce={reduce} />
        </motion.div>
      </div>
    </div>
  );
}

/** The GitHub link as a glass button: the repo's mark and name, then its stars and an arrow. */
const GITHUB_LINK =
  "glass flex h-14 items-center gap-3 rounded-[12px] pr-3.5 pl-4";

/** Three facts under the calls to action: free and private as plain lines, open source as a link to the repo with its stars. */
function Facts({
  stars,
  className,
}: {
  stars: number | null;
  className: string;
}) {
  const count = stars === null ? null : stars.toLocaleString("en-US");
  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-x-9 gap-y-3 text-left ${className}`}
    >
      <li className="flex items-center gap-3">
        <FactText
          icon={<Gift />}
          title="100% free"
          note="No account, no fees"
        />
      </li>
      <li className="flex items-center gap-3">
        <FactText
          icon={<ShieldCheck />}
          title="Your data stays in your browser"
          note="We never see or store it"
        />
      </li>
      <li>
        <a
          href={REPO_URL}
          aria-label={
            count === null
              ? "Open source on GitHub"
              : `Open source on GitHub, ${count} ${stars === 1 ? "star" : "stars"}`
          }
          className={GITHUB_LINK}
        >
          <FactText
            icon={<GitHubMark />}
            title="Open source"
            note="Code on GitHub"
          />
          <span className="h-8 w-px bg-line" />
          {count !== null && (
            <span className="flex items-center gap-1.5 font-semibold tabular-nums">
              <Star className="size-4" strokeWidth={2} />
              {count}
            </span>
          )}
          <ArrowUpRight className="size-4 text-fg-muted" strokeWidth={2} />
        </a>
      </li>
    </ul>
  );
}

function FactText({
  icon,
  title,
  note,
}: {
  icon: ReactNode;
  title: string;
  note: string;
}) {
  return (
    <>
      <span className="shrink-0 text-fg-muted [&_svg]:size-5">{icon}</span>
      <span>
        <span className="block font-semibold text-[14px] leading-[18px]">
          {title}
        </span>
        <span className="block text-[12px] text-fg-muted leading-4">
          {note}
        </span>
      </span>
    </>
  );
}

/** GitHub's mark (Octicons mark-github, MIT). */
function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

function FinalCall({ stars }: { stars: number | null }) {
  return (
    <section className="relative overflow-hidden px-8 py-28 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[64rem] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side_at_40%_50%,rgb(218_26_46/0.08),transparent),radial-gradient(closest-side_at_62%_50%,rgb(139_124_235/0.1),transparent)]"
      />
      <div className="relative">
        <h2 className="font-display font-extrabold text-[44px] leading-[50px] tracking-[-0.025em] [font-stretch:112.5%]">
          Start mapping your degree
        </h2>
        <div className="mt-8 flex justify-center">
          <Button asChild className={`glass-red ${GLASS_BUTTON} text-white`}>
            <Link href="/profile">{COPY.importTranscript}</Link>
          </Button>
        </div>
        <Facts stars={stars} className="mt-8" />
      </div>
    </section>
  );
}
