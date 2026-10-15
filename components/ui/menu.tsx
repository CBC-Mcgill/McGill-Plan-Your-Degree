"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";

/** Click to open a menu (pattern C). Escape closes it and focus returns to the trigger. */
export function Menu({
  trigger,
  align = "start",
  children,
}: {
  trigger: ReactNode;
  align?: "start" | "end";
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          collisionPadding={16}
          className="z-[85] max-h-[min(400px,var(--radix-dropdown-menu-content-available-height))] min-w-56 max-w-[var(--radix-dropdown-menu-content-available-width)] overflow-y-auto rounded-lg bg-bg p-1 text-fg shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A 40px option, or a link with `href`. `meta` sits on the right in --fg-muted, or below when the screen is too narrow. */
export function MenuItem({
  onSelect,
  href,
  disabled,
  children,
  meta,
}: {
  onSelect?: (event: Event) => void;
  href?: string;
  disabled?: boolean;
  children: ReactNode;
  meta?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex min-w-0 flex-auto items-center gap-2 whitespace-nowrap">
        {children}
      </span>
      {meta && (
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-normal text-fg-muted tabular-nums">
          {meta}
        </span>
      )}
    </>
  );
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      asChild={href !== undefined}
      className="flex min-h-10 cursor-default select-none flex-wrap items-center gap-x-4 gap-y-0.5 rounded-md px-3 py-2 outline-none data-[disabled]:text-fg-muted data-[highlighted]:selected pointer-coarse:min-h-11"
    >
      {href === undefined ? content : <Link href={href}>{content}</Link>}
    </DropdownMenu.Item>
  );
}

/** A small heading over a run of options, with a line above it after the first run. Its options name it too, since screen readers skip it. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="-mx-1 px-4 pt-2 pb-1 text-[13px] text-fg-muted leading-[18px] [&:not(:first-child)]:mt-1 [&:not(:first-child)]:border-line [&:not(:first-child)]:border-t">
      {children}
    </DropdownMenu.Label>
  );
}
