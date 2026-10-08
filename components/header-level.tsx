"use client";

import Link from "next/link";
import { XpBar } from "@/components/xp-bar";
import { XP_PER_LEVEL } from "@/lib/game/progress";
import { useGameProgress, useHasCourses } from "@/lib/game/use-game-progress";

/** The student's level and XP in the header. Nothing shows until the profile has courses. */
export function HeaderLevel() {
  const hasCourses = useHasCourses();
  return hasCourses ? <LevelLink /> : null;
}

function LevelLink() {
  const game = useGameProgress();
  if (!game) return null;

  return (
    <Link
      href="/profile#badges"
      title={`${game.xpToNextLevel} XP to level ${game.level + 1}`}
      className="flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-subtle"
    >
      <span className="font-display font-extrabold text-[13px] font-stretch-semi-expanded">
        Lv {game.level}
      </span>
      <XpBar
        xp={game.xpIntoLevel}
        max={XP_PER_LEVEL}
        label={`${game.xp.toLocaleString("en-US")} XP`}
        barClassName="max-[1200px]:w-16"
        captionClassName="max-[1200px]:sr-only"
      />
    </Link>
  );
}
