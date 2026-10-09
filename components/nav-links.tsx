"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

const links: { href: string; label: string; soon?: boolean }[] = [
  { href: "/courses", label: "Browse courses" },
  { href: "/next", label: "What's next" },
  { href: "/requirements", label: "Requirements" },
  { href: "/plan", label: "Planner" },
  { href: "/profile", label: "Profile" },
  { href: "/advisor", label: "Advisor", soon: true },
];

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
    <ul className="flex h-full items-center gap-1">
      {links.map(({ href, label, soon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href} className="h-full">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 font-medium text-sm transition-colors focus-visible:outline-offset-[-2px]",
                active
                  ? "text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {soon && <Badge>Soon</Badge>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
