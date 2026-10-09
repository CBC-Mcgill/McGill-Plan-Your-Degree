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

/** Browse courses, What's next and Planner, then search centered in the space before Profile, which sits on the right. /courses has its own search field, so the header one hides there (D22). */
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
        <li className="ml-auto w-110 min-w-70 shrink">
          <SearchBar />
        </li>
      )}
      <li className="-mr-3 ml-auto">
        <NavLink href="/profile" label="Profile" />
      </li>
    </ul>
  );
}
