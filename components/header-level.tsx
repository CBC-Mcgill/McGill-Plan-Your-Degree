"use client";

import { cn } from "cn";
import Link from "next/link";
import { XpBar } from "@/components/xp-bar";
import { useCatalogue } from "@/lib/catalogue/client";
import { XP_PER_LEVEL } from "@/lib/game/progress";
import { useGameProgress, useHasCourses } from "@/lib/game/use-game-progress";

// A fixed width, so the search bar stays put while the chip waits for the catalogue.
const CHIP =
  "flex h-8 w-[13.5rem] shrink-0 items-center gap-2.5 rounded-md px-2 max-[1200px]:w-[7.5rem]";

/** The student's level and XP in the header. Nothing shows until the profile has courses. */
export function HeaderLevel() {
  const hasCourses = useHasCourses();
  return hasCourses ? <LevelLink /> : null;
}

function LevelLink() {
  const game = useGameProgress();
  const catalogue = useCatalogue();
  if (!game) {
    return catalogue.status === "error" ? null : (
      <div aria-hidden className={CHIP}>
        <span className="h-4 w-8 rounded-sm bg-muted motion-safe:animate-pulse" />
        <span className="h-1.5 flex-1 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
    );
  }

  return (
    <Link
      href="/profile#badges"
      title={`${game.xpToNextLevel} XP to level ${game.level + 1}`}
      className={cn(CHIP, "transition-colors hover:bg-subtle")}
    >
      <span className="font-display font-extrabold text-[13px] font-stretch-semi-expanded">
        Lv {game.level}
      </span>
      <XpBar
        xp={game.xpIntoLevel}
        max={XP_PER_LEVEL}
        label={`${game.xp.toLocaleString("en-US")} XP`}
        className="min-w-0 flex-1"
        barClassName="min-w-0 flex-1"
        captionClassName="max-[1200px]:sr-only"
      />
    </Link>
  );
}
