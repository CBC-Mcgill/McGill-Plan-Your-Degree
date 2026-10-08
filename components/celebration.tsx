"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { forgetSeen, type Gains, takeGains } from "@/lib/game/seen";
import { useGameProgress, useHasCourses } from "@/lib/game/use-game-progress";
import { useProfileHydrated } from "@/lib/profile/store";

const DISMISS_MS = 6000;

function describe({ xp, level, badges }: Gains): string[] {
  const lines: string[] = [];
  if (xp > 0) lines.push(`+${xp.toLocaleString("en-US")} XP`);
  if (level !== null) lines.push(`Level ${level} reached`);
  if (badges.length > 2) lines.push(`${badges.length} badges earned`);
  else for (const badge of badges) lines.push(`Badge earned: ${badge.name}`);
  return lines;
}

/** A toast for new XP, levels and badges. Mounted once in the layout. */
export function Celebration() {
  const hydrated = useProfileHydrated();
  const hasCourses = useHasCourses();

  // An emptied profile starts over, so the next import celebrates again.
  useEffect(() => {
    if (hydrated && !hasCourses) forgetSeen();
  }, [hydrated, hasCourses]);

  return hasCourses ? <GainToast /> : null;
}

function GainToast() {
  const game = useGameProgress();
  const [gains, setGains] = useState<Gains | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!game) return;
    const next = takeGains(game);
    if (next) setGains(next);
  }, [game]);

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
    <div className="pointer-events-none fixed right-8 bottom-8 z-40 w-80">
      <AnimatePresence>
        {gains && (
          <motion.div
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-lg border-2 border-border-strong bg-card p-4 shadow-edge"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-completed-surface text-xp">
              <Sparkles aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-extrabold text-lg leading-tight">{title}</p>
              {rest.map((line) => (
                <p
                  key={line}
                  className="mt-1 font-semibold text-muted-foreground text-sm"
                >
                  {line}
                </p>
              ))}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setGains(null)}
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-[background-color] hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
