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
import { BadgeTile } from "@/components/badge-tile";
import { CatalogueError } from "@/components/catalogue-error";
import { SectionCard } from "@/components/section-card";
import { useCatalogue } from "@/lib/catalogue/client";
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
  const catalogue = useCatalogue();

  return (
    <SectionCard
      id="badges"
      title="Badges"
      trailing={
        game &&
        `${game.earned.length} of ${game.earned.length + game.locked.length} earned`
      }
    >
      {!game && catalogue.status === "error" && <CatalogueError />}
      {!game && catalogue.status === "loading" && <BadgesSkeleton />}
      {game && (
        <>
          <p className="text-[13px] text-muted-foreground">
            You are level {game.level} with {game.xp.toLocaleString("en-US")}{" "}
            XP. Every credit you earn is worth {XP_PER_CREDIT} XP, and advanced
            standing and transfer credits count too.
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
    </SectionCard>
  );
}

/** The caption and a grid of tiles at their usual size, so the page does not jump when the badges arrive. */
function BadgesSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-5 w-3/4 rounded-sm bg-muted motion-safe:animate-pulse" />
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {Array.from({ length: 13 }, (_, tile) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            key={tile}
            className="h-[11.75rem] rounded-lg bg-muted motion-safe:animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
