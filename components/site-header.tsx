import Link from "next/link";
import { SearchBar } from "@/components/command-palette";
import { NavLinks } from "@/components/nav-links";

/** The top navigation bar: logo, pages, and a search bar that opens the command palette. */
export function SiteHeader() {
  return (
    <header className="bg-card shadow-[inset_0_-1px_0_var(--border)]">
      <div className="mx-auto flex h-14 max-w-page items-center gap-5 px-8 max-[1120px]:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-sm"
        >
          <LogoMark />
          <span className="font-display font-extrabold text-base tracking-tight font-stretch-semi-expanded max-[1260px]:sr-only">
            Plan Your Degree
          </span>
        </Link>
        <nav aria-label="Main" className="h-full">
          <NavLinks />
        </nav>
        <SearchBar className="ml-auto" />
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path
        fill="white"
        d="M6 26v-5h6v-4.5h6V12h4V4.75h1.75l4.5 2.25-4.5 2.25V12H26v14z"
      />
    </svg>
  );
}
