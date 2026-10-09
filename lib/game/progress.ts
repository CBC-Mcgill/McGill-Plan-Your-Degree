import { earnedCredits } from "../engine/credits.ts";
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
  | "records"
  | "plan"
  | "graduationTerm"
  | "creditLimit"
  | "entry"
  | "advancedStanding"
>;

export interface Level {
  level: number;
  xpIntoLevel: number;
  /** XP still missing to reach the next level. */
  xpToNextLevel: number;
}

export interface GameProgress extends Level {
  xp: number;
  /** Credits that count toward XP, and toward credit badges, without a course the student took here. */
  advancedStanding: number;
  transferCredits: number;
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

/** XP comes from earned credits only: completed, transfer and advanced standing. Exemptions, in-progress and planned courses add none. */
export function gameProgress(
  profile: GameProfile,
  catalogue: Catalogue,
  program: Program | null,
): GameProgress {
  const { records, plan, entry } = profile;
  const snapshot = buildSnapshot(records, plan, entry);
  const creditsOf = (code: string) => catalogue.get(code)?.credits ?? 0;

  const credits = earnedCredits(snapshot, catalogue) + profile.advancedStanding;
  const xp = Math.round(credits * XP_PER_CREDIT);
  const transferCredits = records.reduce(
    (sum, r) =>
      r.status === "transfer" ? sum + (r.credits ?? creditsOf(r.code)) : sum,
    0,
  );

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
    progress: program
      ? programProgress(program, snapshot, catalogue, { entry })
      : null,
    projected: program
      ? programProgress(program, snapshot, catalogue, {
          inProgress: true,
          planned: true,
          entry,
        })
      : null,
    warnings: planWarnings(
      plan,
      snapshot,
      catalogue,
      profile.creditLimit,
      profile.graduationTerm,
    ),
    credits,
    termCredits: [...byTerm.values()],
  };
  const earned = BADGES.filter((badge) => badge.earned(context));
  return {
    xp,
    advancedStanding: profile.advancedStanding,
    transferCredits,
    ...levelOf(xp),
    plannedXp: Math.round(plannedCredits * XP_PER_CREDIT),
    earned,
    locked: BADGES.filter((badge) => !earned.includes(badge)),
  };
}
