import type { Badge } from "./badges.ts";
import type { GameProgress } from "./progress.ts";

export const SEEN_STORAGE_KEY = "plan-your-degree:seen";

/** The highest XP, level and badges the student has been shown. */
interface Seen {
  xp: number;
  level: number;
  badges: string[];
}

export interface Gains {
  xp: number;
  /** The new level, when it went up. */
  level: number | null;
  badges: Badge[];
  /** On the first celebration only, the credits inside the XP that no course of the student's earned. */
  bonus: { advancedStanding: number; transfer: number } | null;
}

let quiet = false;

/** The next progress change celebrates nothing and is taken as already seen, for a restored backup. */
export function stayQuiet(): void {
  quiet = true;
}

function read(): Seen {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) ?? "null");
    if (
      typeof seen?.xp === "number" &&
      typeof seen.level === "number" &&
      Array.isArray(seen.badges)
    ) {
      return seen;
    }
  } catch {
    // Missing, blocked, or corrupt storage counts as nothing seen.
  }
  return { xp: 0, level: 1, badges: [] };
}

/**
 * What is new since the student was last shown their progress, or null.
 * It remembers the highest values, so removing a course and adding it back celebrates nothing.
 * It celebrates nothing for a profile edit, a restored backup, or when storage cannot keep the progress, since a celebration would repeat on every change.
 */
export function takeGains(game: GameProgress, edit = false): Gains | null {
  const silent = quiet || edit;
  quiet = false;
  const seen = read();
  const gains: Gains = {
    xp: Math.max(0, game.xp - seen.xp),
    level: game.level > seen.level ? game.level : null,
    badges: game.earned.filter((badge) => !seen.badges.includes(badge.id)),
    bonus:
      seen.xp === 0
        ? {
            advancedStanding: game.advancedStanding,
            transfer: game.transferCredits,
          }
        : null,
  };
  const next: Seen = {
    xp: Math.max(seen.xp, game.xp),
    level: Math.max(seen.level, game.level),
    badges: [...new Set([...seen.badges, ...game.earned.map((b) => b.id)])],
  };
  let saved = true;
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    saved = false;
  }
  return !silent &&
    saved &&
    (gains.xp > 0 || gains.level !== null || gains.badges.length > 0)
    ? gains
    : null;
}

/** For an emptied profile, so the next import celebrates again. */
export function forgetSeen(): void {
  try {
    localStorage.removeItem(SEEN_STORAGE_KEY);
  } catch {
    // Nothing to forget when storage is blocked.
  }
}
