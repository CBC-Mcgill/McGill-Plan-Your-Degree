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
import { Card } from "@/components/ui/card";
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
    <Card asChild className="p-5">
      <section id="badges">
        <div className="flex items-baseline justify-between gap-6">
          <h2 className="text-base">Badges</h2>
          {game && (
            <p className="text-[13px] text-muted-foreground">
              {game.earned.length} of {game.earned.length + game.locked.length}{" "}
              earned
            </p>
          )}
        </div>
        {game && (
          <>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              You are level {game.level} with {game.xp.toLocaleString("en-US")}{" "}
              XP. Every credit you earn is worth {XP_PER_CREDIT} XP.
              {game.plannedXp > 0 &&
                ` Your planned courses add ${game.plannedXp.toLocaleString("en-US")} XP once you complete them.`}
            </p>
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
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
    </Card>
  );
}
