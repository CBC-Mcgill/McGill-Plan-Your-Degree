"use client";

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
          className="z-[85] max-h-[min(400px,var(--radix-dropdown-menu-content-available-height))] min-w-56 overflow-y-auto rounded-lg bg-bg p-1 text-fg shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A 40px option. `meta` sits on the right in --fg-muted. */
export function MenuItem({
  onSelect,
  disabled,
  children,
  meta,
}: {
  onSelect: (event: Event) => void;
  disabled?: boolean;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className="flex h-10 cursor-default select-none items-center gap-4 rounded-md px-3 outline-none data-[disabled]:text-fg-muted data-[highlighted]:selected"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
        {children}
      </span>
      {meta && (
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-normal text-fg-muted tabular-nums">
          {meta}
        </span>
      )}
    </DropdownMenu.Item>
  );
}
