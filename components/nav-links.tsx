"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SearchBar } from "@/components/command-palette";

const PAGES = [
  { href: "/courses", label: "Browse courses" },
  { href: "/next", label: "What's next" },
  { href: "/plan", label: "Planner" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-label={label}
      className={cn(
        "steady-width h-9 whitespace-nowrap rounded-md px-3",
        active ? "selected" : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

/** Browse courses, What's next and Planner, then search at the center and Profile on the right. /courses has its own search field, so the header one hides there (D22). */
export function NavLinks() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const search = !(pathname === "/courses");

  // A client navigation leaves keyboard focus on the header link, so the next Tab would walk the header again.
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const active = document.activeElement;
    if (!active || active === document.body || active.closest("header")) {
      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <ul className="flex items-center gap-1">
      {PAGES.map((page) => (
        <li key={page.href}>
          <NavLink {...page} />
        </li>
      ))}
      {search && (
        // 382px is the widest the bar can be and still sit at the page's center, 32px clear of the logo and nav (377px) on a 1200px page.
        <li className="ml-7 min-w-70 max-w-[382px] flex-1">
          <SearchBar />
        </li>
      )}
      <li className="ml-auto pl-7">
        <NavLink href="/profile" label="Profile" />
      </li>
    </ul>
  );
}
