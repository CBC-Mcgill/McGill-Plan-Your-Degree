"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: { href: string; label: string; soon?: boolean }[] = [
  { href: "/courses", label: "Browse courses" },
  { href: "/next", label: "What's next" },
  { href: "/plan", label: "Planner" },
  { href: "/profile", label: "Profile" },
  { href: "/advisor", label: "Advisor", soon: true },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1">
      {links.map(({ href, label, soon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-10 items-center whitespace-nowrap rounded-md px-2 font-semibold xl:px-3 text-[0.9375rem] text-muted-foreground transition-[color] after:absolute after:inset-x-2 xl:after:inset-x-3 after:-bottom-[13px] after:h-1 after:rounded-t-sm after:bg-primary after:opacity-0 hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100"
            >
              {label}
              {soon && (
                <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-bold text-[0.6875rem] text-muted-foreground leading-none">
                  Soon
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
