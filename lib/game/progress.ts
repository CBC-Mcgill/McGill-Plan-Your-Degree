import { planWarnings } from "../engine/plan.ts";
import { programProgress } from "../engine/progress.ts";
import { buildSnapshot, type Catalogue } from "../engine/snapshot.ts";
import { type Profile, termKey } from "../profile/types.ts";
import type { Program } from "../programs/types.ts";
import { BADGES, type Badge, type BadgeContext } from "./badges.ts";

export const XP_PER_CREDIT = 100;
/** Roughly one full term. */
export const CREDITS_PER_LEVEL = 15;
export const XP_PER_LEVEL = XP_PER_CREDIT * CREDITS_PER_LEVEL;

export type GameProfile = Pick<
  Profile,
  "records" | "plan" | "graduationTerm" | "creditLimit"
>;

export interface Level {
  level: number;
  xpIntoLevel: number;
  /** XP still missing to reach the next level. */
  xpToNextLevel: number;
}

export interface GameProgress extends Level {
  xp: number;
  /** XP the planned courses would add once completed. They award nothing yet. */
  plannedXp: number;
  earned: Badge[];
  locked: Badge[];
}

export function levelOf(xp: number): Level {
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return {
    level: 1 + Math.floor(xp / XP_PER_LEVEL),
    xpIntoLevel,
    xpToNextLevel: XP_PER_LEVEL - xpIntoLevel,
  };
}

/** XP comes from earned credits only: completed and transfer. Exemptions, in-progress and planned courses add none. */
export function gameProgress(
  profile: GameProfile,
  catalogue: Catalogue,
  program: Program | null,
): GameProgress {
  const { records, plan } = profile;
  const snapshot = buildSnapshot(records, plan);
  const creditsOf = (code: string) => catalogue.get(code)?.credits ?? 0;

  let credits = 0;
  for (const [code, stated] of snapshot.earned) {
    credits += stated ?? creditsOf(code);
  }
  const xp = Math.round(credits * XP_PER_CREDIT);

  let plannedCredits = 0;
  for (const code of snapshot.planned) {
    if (!snapshot.taken.has(code)) plannedCredits += creditsOf(code);
  }

  const byTerm = new Map<number, number>();
  for (const record of records) {
    if (record.status === "completed" && record.term) {
      const key = termKey(record.term);
      byTerm.set(
        key,
        (byTerm.get(key) ?? 0) + (record.credits ?? creditsOf(record.code)),
      );
    }
  }

  const context: BadgeContext = {
    profile,
    snapshot,
    catalogue,
    program,
    progress: program ? programProgress(program, snapshot, catalogue) : null,
    projected: program
      ? programProgress(program, snapshot, catalogue, {
          inProgress: true,
          planned: true,
        })
      : null,
    warnings: planWarnings(plan, snapshot, catalogue, profile.creditLimit),
    credits,
    termCredits: [...byTerm.values()],
  };
  const earned = BADGES.filter((badge) => badge.earned(context));
  return {
    xp,
    ...levelOf(xp),
    plannedXp: Math.round(plannedCredits * XP_PER_CREDIT),
    earned,
    locked: BADGES.filter((badge) => !earned.includes(badge)),
  };
}
