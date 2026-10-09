import Link from "next/link";
import { NavLinks } from "@/components/nav-links";

/** The top bar: the logo and the three planning pages, search centered between them and Profile on the right. No line and no red. */
export function SiteHeader() {
  return (
    <header className="bg-bg">
      <div className="mx-auto flex h-16 max-w-page items-center gap-8 px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md font-semibold"
        >
          <LogoMark />
          <span className="max-[1259px]:sr-only">Plan Your Degree</span>
        </Link>
        <nav aria-label="Main" className="min-w-0 flex-1">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="size-6 shrink-0">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <path
        className="fill-bg"
        d="M6 26v-5h6v-4.5h6V12h4V4.75h1.75l4.5 2.25-4.5 2.25V12H26v14z"
      />
    </svg>
  );
}
