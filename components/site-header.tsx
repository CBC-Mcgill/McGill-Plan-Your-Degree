import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { XpBar } from "@/components/xp-bar";

// Static placeholder until the gamification PR derives level and XP from the profile
const placeholderProgress = { level: "U1", xp: 120, nextLevelXp: 300 };

export function SiteHeader() {
  return (
    <header className="border-border border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md font-extrabold text-lg tracking-tight font-stretch-semi-expanded"
        >
          <LogoMark />
          Plan Your Degree
        </Link>
        <nav aria-label="Main">
          <NavLinks />
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="whitespace-nowrap font-bold text-sm">
            Level {placeholderProgress.level}
          </span>
          <XpBar
            xp={placeholderProgress.xp}
            max={placeholderProgress.nextLevelXp}
          />
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        fill="white"
        d="M6 26v-5h6v-4.5h6V12h4V4.75h1.75l4.5 2.25-4.5 2.25V12H26v14z"
      />
    </svg>
  );
}
