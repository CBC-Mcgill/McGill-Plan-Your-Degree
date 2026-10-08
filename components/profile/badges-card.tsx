"use client";

import {
  Award,
  Blocks,
  CalendarCheck,
  ClipboardCheck,
  Compass,
  Crown,
  Dumbbell,
  Footprints,
  GraduationCap,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Medal,
  Trophy,
} from "lucide-react";
import { useEffect } from "react";
import { BadgeTile } from "@/components/badge-tile";
import type { Badge } from "@/lib/game/badges";
import { XP_PER_CREDIT } from "@/lib/game/progress";
import { useGameProgress } from "@/lib/game/use-game-progress";

const ICONS: Record<Badge["icon"], LucideIcon> = {
  Footprints,
  CalendarCheck,
  Medal,
  Award,
  Trophy,
  Crown,
  Dumbbell,
  Blocks,
  ListChecks,
  Compass,
  Map: MapIcon,
  ClipboardCheck,
  GraduationCap,
};

export function BadgesCard() {
  const game = useGameProgress();

  // The profile renders after hydration, so the browser has already missed the #badges anchor on a full page load.
  useEffect(() => {
    if (window.location.hash === "#badges") {
      document.getElementById("badges")?.scrollIntoView();
    }
  }, []);

  return (
    <section
      id="badges"
      className="rounded-lg border-2 border-border bg-card p-6"
    >
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="text-xl">Badges</h2>
        {game && (
          <p className="text-muted-foreground text-sm">
            {game.earned.length} of {game.earned.length + game.locked.length}{" "}
            earned
          </p>
        )}
      </div>
      {game && (
        <>
          <p className="mt-1 text-muted-foreground text-sm">
            You are level {game.level} with {game.xp.toLocaleString("en-US")}{" "}
            XP. Every credit you earn is worth {XP_PER_CREDIT} XP.
            {game.plannedXp > 0 &&
              ` Your planned courses add ${game.plannedXp.toLocaleString("en-US")} XP once you complete them.`}
          </p>
          <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
            {[...game.earned, ...game.locked].map((badge) => (
              <BadgeTile
                key={badge.id}
                className="w-full"
                name={badge.name}
                description={badge.description}
                icon={ICONS[badge.icon]}
                earned={game.earned.includes(badge)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
