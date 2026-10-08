import { type PlanWarning, termRange } from "../engine/plan.ts";
import { namesCourses, type ProgramProgress } from "../engine/progress.ts";
import type { Catalogue, Snapshot } from "../engine/snapshot.ts";
import {
  compareTerms,
  type Profile,
  termFromKey,
  termKey,
} from "../profile/types.ts";
import type { Program } from "../programs/types.ts";

export interface BadgeContext {
  profile: Pick<Profile, "records" | "plan" | "graduationTerm">;
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  /** Counts done courses only. Null without a program. */
  progress: ProgramProgress | null;
  /** Also counts courses in progress and planned. Null without a program. */
  projected: ProgramProgress | null;
  warnings: PlanWarning[];
  /** Credits earned: completed and transfer. */
  credits: number;
  /** Credits completed in each term, transfer credits left out. */
  termCredits: number[];
}

export interface Badge {
  id: string;
  name: string;
  /** How to earn it, in one plain line. */
  description: string;
  /** A lucide-react icon name. */
  icon:
    | "Footprints"
    | "CalendarCheck"
    | "Medal"
    | "Award"
    | "Trophy"
    | "Crown"
    | "Dumbbell"
    | "Blocks"
    | "ListChecks"
    | "Compass"
    | "Map"
    | "ClipboardCheck"
    | "GraduationCap";
  earned: (context: BadgeContext) => boolean;
}

const creditsBadge = (
  credits: number,
  icon: Badge["icon"],
): Pick<Badge, "id" | "name" | "description" | "icon" | "earned"> => ({
  id: `credits-${credits}`,
  name: `${credits} credits`,
  description: `Earn ${credits} credits.`,
  icon,
  earned: (context) => context.credits >= credits,
});

/** Every term after the last one with a course, up to graduation, has a planned course. */
function mappedOut({ profile }: BadgeContext): boolean {
  const last = profile.records
    .flatMap((record) => record.term ?? [])
    .sort((a, b) => compareTerms(b, a))[0];
  if (!last || !profile.graduationTerm) return false;
  const planned = new Set(
    profile.plan
      .filter((entry) => entry.courses.length > 0)
      .map((entry) => termKey(entry.term)),
  );
  const ahead = termRange(
    termFromKey(termKey(last) + 1),
    profile.graduationTerm,
  );
  return ahead.length > 0 && ahead.every((term) => planned.has(termKey(term)));
}

export const BADGES: Badge[] = [
  {
    id: "first-steps",
    name: "First steps",
    description: "Add your first courses to your profile.",
    icon: "Footprints",
    earned: ({ profile }) => profile.records.length > 0,
  },
  {
    id: "term-cleared",
    name: "Term cleared",
    description: "Complete 12 or more credits in one term.",
    icon: "CalendarCheck",
    earned: ({ termCredits }) => termCredits.some((credits) => credits >= 12),
  },
  creditsBadge(30, "Medal"),
  creditsBadge(60, "Award"),
  creditsBadge(90, "Trophy"),
  creditsBadge(120, "Crown"),
  {
    id: "full-load",
    name: "Full load",
    description: "Complete 15 or more credits in one term.",
    icon: "Dumbbell",
    earned: ({ termCredits }) => termCredits.some((credits) => credits >= 15),
  },
  {
    id: "required-block",
    name: "Block finished",
    description: "Finish every course in one required block of your program.",
    icon: "Blocks",
    earned: ({ progress }) =>
      Boolean(
        progress?.groups.some(
          (group) =>
            group.kind === "required" &&
            group.satisfied &&
            group.coursesDone > 0,
        ),
      ),
  },
  {
    id: "complementary-list",
    name: "List finished",
    description: "Finish one complementary list of your program.",
    icon: "ListChecks",
    earned: ({ program, progress }) =>
      Boolean(
        progress?.groups.some((group, i) => {
          const listed = program?.groups[i];
          return (
            listed?.kind === "complementary" &&
            namesCourses(listed) &&
            group.satisfied &&
            group.creditsDone > 0
          );
        }),
      ),
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "Complete courses in 4 different subjects.",
    icon: "Compass",
    earned: ({ snapshot }) =>
      new Set([...snapshot.earned.keys()].map((code) => code.slice(0, 4)))
        .size >= 4,
  },
  {
    id: "mapped-out",
    name: "Mapped out",
    description: "Plan a course in every term until you graduate.",
    icon: "Map",
    earned: mappedOut,
  },
  {
    id: "clean-plan",
    name: "Clean plan",
    description: "Plan your way to graduation with no warnings.",
    icon: "ClipboardCheck",
    earned: ({ projected, warnings }) =>
      projected?.satisfied === true && warnings.length === 0,
  },
  {
    id: "graduation-ready",
    name: "Graduation ready",
    description: "Complete every requirement of your program.",
    icon: "GraduationCap",
    earned: ({ progress }) => progress?.satisfied === true,
  },
];
