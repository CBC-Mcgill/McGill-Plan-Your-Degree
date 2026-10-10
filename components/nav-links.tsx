"use client";

import { cn } from "cn";
import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { openCommandPalette, SearchBar } from "@/components/command-palette";

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

const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-tint hover:text-fg";

/** Below 1024px: a search button and a menu that opens every page as a sheet under the header. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigated = useRef(false);

  // A link in the sheet navigates, so the sheet closes with the old page.
  useEffect(() => {
    if (!pathname) return;
    setOpen(false);
  }, [pathname]);

  return (
    <div className="-mr-2 ml-auto flex items-center lg:hidden">
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search courses"
        className={ICON_BUTTON}
      >
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          aria-label={open ? "Close menu" : "Menu"}
          className={ICON_BUTTON}
        >
          {open ? (
            <X aria-hidden className="size-5" strokeWidth={1.75} />
          ) : (
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
          )}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-x-0 top-16 bottom-0 z-30 bg-scrim" />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              if (!navigated.current) return;
              navigated.current = false;
              event.preventDefault();
              document.getElementById("main")?.focus({ preventScroll: true });
            }}
            className="fixed inset-x-0 top-16 z-40 border-line border-b bg-bg px-2 pb-3 shadow-float md:px-6"
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <nav aria-label="Main">
              <ul className="flex flex-col pt-2">
                {[...PAGES, { href: "/profile", label: "Profile" }].map(
                  (page) => {
                    const active =
                      pathname === page.href ||
                      pathname.startsWith(`${page.href}/`);
                    return (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            navigated.current = true;
                            setOpen(false);
                          }}
                          className={cn(
                            "flex h-12 items-center gap-2 rounded-md px-3 text-base",
                            active ? "selected" : "text-fg",
                          )}
                        >
                          {page.label}
                          {"soon" in page && page.soon && (
                            <span className="rounded-[5px] bg-tint px-1.5 font-normal text-[11px] text-fg-muted leading-[18px]">
                              Soon
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
