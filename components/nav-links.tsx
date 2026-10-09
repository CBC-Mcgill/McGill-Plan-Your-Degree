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
  { href: "/advisor", label: "Advisor", soon: true },
];

function NavLink({
  href,
  label,
  soon = false,
}: {
  href: string;
  label: string;
  soon?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3",
        active ? "selected" : "text-fg-muted hover:text-fg",
      )}
    >
      <span className="steady-width" data-label={label}>
        {label}
      </span>{" "}
      {soon && (
        <span
          className={cn(
            "rounded-[5px] px-1.5 font-normal text-[11px] text-fg-muted leading-[18px]",
            active ? "bg-bg" : "bg-tint",
          )}
        >
          Soon
        </span>
      )}
    </Link>
  );
}

/** Browse courses, What's next, Planner and Advisor, then search centered in the space before Profile, which sits on the right. */
export function NavLinks() {
  const pathname = usePathname();
  const previous = useRef(pathname);

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
      <li className="ml-auto w-110 min-w-70 shrink">
        <SearchBar />
      </li>
      <li className="-mr-3 ml-auto">
        <NavLink href="/profile" label="Profile" />
      </li>
    </ul>
  );
}
