"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { forgetSeen, type Gains, takeGains } from "@/lib/game/seen";
import { useGameProgress, useHasCourses } from "@/lib/game/use-game-progress";
import {
  useProfileHydrated,
  useProfileStore,
  useSaveStatus,
} from "@/lib/profile/store";

const DISMISS_MS = 6000;

function describe({ xp, level, badges, bonus }: Gains): string[] {
  const lines: string[] = [];
  if (xp > 0) lines.push(`+${xp.toLocaleString("en-US")} XP`);
  const counted = [
    bonus?.advancedStanding && `${bonus.advancedStanding} advanced standing`,
    bonus?.transfer && `${bonus.transfer} transfer`,
  ].filter(Boolean);
  if (xp > 0 && counted.length > 0) {
    const total = (bonus?.advancedStanding ?? 0) + (bonus?.transfer ?? 0);
    lines.push(
      `Includes ${counted.join(" and ")} credit${total === 1 ? "" : "s"}`,
    );
  }
  if (level !== null) lines.push(`Level ${level} reached`);
  if (badges.length > 2) lines.push(`${badges.length} badges earned`);
  else for (const badge of badges) lines.push(`Badge earned: ${badge.name}`);
  return lines;
}

/** A toast for new XP, levels and badges. Mounted once in the layout, and its live region is always there so the news is announced. */
export function Celebration() {
  const hydrated = useProfileHydrated();
  const hasCourses = useHasCourses();
  const saveFailed = useSaveStatus((state) => state.failed);

  // An emptied profile starts over, so the next import celebrates again.
  useEffect(() => {
    if (hydrated && !hasCourses) forgetSeen();
  }, [hydrated, hasCourses]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed right-8 bottom-8 z-40 w-80"
    >
      {hasCourses && !saveFailed && <GainToast />}
    </div>
  );
}

function GainToast() {
  const game = useGameProgress();
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const progressed = useRef<[typeof records, typeof plan] | null>(null);
  const [gains, setGains] = useState<Gains | null>(null);
  const [paused, setPaused] = useState(false);

  // Only courses and the plan are progress. Editing the profile's fields changes the XP too, but is not celebrated.
  useEffect(() => {
    if (!game) return;
    const last = progressed.current;
    progressed.current = [records, plan];
    const edit = last !== null && last[0] === records && last[1] === plan;
    const next = takeGains(game, edit);
    if (next) setGains(next);
  }, [game, records, plan]);

  useEffect(() => {
    if (!gains || paused) return;
    const timer = setTimeout(() => setGains(null), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [gains, paused]);

  useEffect(() => {
    if (!gains) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGains(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gains]);

  const [title, ...rest] = gains ? describe(gains) : [];

  return (
    <AnimatePresence>
      {gains && (
        <motion.div
          className="pointer-events-auto flex items-start gap-3 rounded-lg bg-card p-4 shadow-float"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-xp-surface text-xp-foreground">
            <Sparkles aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-display font-extrabold text-lg leading-tight font-stretch-semi-expanded">
              {title}
            </p>
            {rest.map((line) => (
              <p
                key={line}
                className="mt-1 text-balance font-medium text-[13px] text-muted-foreground"
              >
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setGains(null)}
            className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-[background-color] hover:bg-subtle hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
