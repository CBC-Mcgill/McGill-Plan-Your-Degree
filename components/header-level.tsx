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
      className="-mr-3 ml-auto flex shrink-0 items-center gap-3 rounded-md px-3 py-2 transition-[background-color] hover:bg-muted"
    >
      <span className="font-extrabold">Level {game.level}</span>
      <XpBar xp={game.xpIntoLevel} max={XP_PER_LEVEL} />
    </Link>
  );
}
