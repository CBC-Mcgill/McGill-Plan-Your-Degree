"use client";

import { cn } from "cn";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Checkbox, Popover } from "radix-ui";
import type * as React from "react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { controlStyles } from "@/components/ui/field";
import { Menu, MenuItem } from "@/components/ui/menu";
import {
  chipText,
  type Option,
  PROP_LABEL,
  type Prop,
  SORTS,
  type SortKey,
} from "@/lib/engine/browse";

const PLURAL: Partial<Record<Prop, string>> = {
  subject: "subjects",
  faculty: "faculties",
};

/** The page's search field. `shortcut` is the key that focuses it, announced but not drawn. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  shortcut,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange"> & {
  onChange: (value: string) => void;
  shortcut?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-keyshortcuts={shortcut}
        className={cn(
          controlStyles,
          "w-full pr-9 pl-9 max-md:h-11 max-md:pr-11 max-md:text-base [&::-webkit-search-cancel-button]:hidden",
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:text-fg max-md:right-0 max-md:size-11"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox inside is the control
    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 hover:bg-tint has-focus-visible:bg-tint max-md:h-11">
      <Checkbox.Root
        data-nav
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-fg-subtle bg-bg focus-visible:outline-offset-2 data-[state=checked]:border-fg data-[state=checked]:bg-fg"
      >
        <Checkbox.Indicator>
          <Check aria-hidden className="size-3 text-white" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  );
}

/** Arrow keys walk the [data-nav] elements inside a popover, search field first. */
function navKeys(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "[data-nav]:not(:disabled)",
    ),
  ];
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = items[at + (event.key === "ArrowDown" ? 1 : -1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

/** One filter: a chip that opens a checkbox list, with a search field when the list is long. The chip's × clears it. */
export function FilterPopover({
  prop,
  options,
  selected,
  onChange,
  open,
  onOpenChange,
}: {
  prop: Prop;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const searchable = options.length > 12;
  const noun = PLURAL[prop] ?? PROP_LABEL[prop].toLowerCase();
  const text = query.trim().toLowerCase();
  const visible = text
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(text) ||
          o.hint?.toLowerCase().includes(text),
      )
    : options;
  const value = selected.length ? chipText(prop, selected) : undefined;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <Chip
          label={PROP_LABEL[prop]}
          value={value}
          title={value}
          onClear={() => onChange([])}
          // 44px on a phone, the clear button too.
          className="max-w-64 max-md:h-11 max-md:shrink-0 max-md:[&>button+button]:mr-0 max-md:[&>button+button]:h-11 max-md:[&>button+button]:w-10"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          onKeyDown={navKeys}
          // A touch screen keeps its keyboard down until the student taps the search field, so the list stays in view.
          onOpenAutoFocus={(event) => {
            if (!matchMedia("(pointer: coarse)").matches) return;
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            "z-[85] rounded-lg bg-bg p-1 text-fg shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none",
            prop === "faculty" ? "w-96" : "w-64",
            "max-md:w-[calc(100vw-2rem)]",
          )}
        >
          {searchable && (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
              />
              <input
                data-nav
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${noun}`}
                aria-label={`Search ${noun}`}
                className="h-10 w-full rounded-md bg-transparent pr-3 pl-9 placeholder:text-fg-muted focus-visible:-outline-offset-2 max-md:h-11 max-md:text-base"
              />
            </div>
          )}
          <div className="max-h-[280px] overflow-y-auto max-md:max-h-[min(352px,50dvh)]">
            {visible.map((option, i) => (
              <Fragment key={option.value}>
                {option.group && option.group !== visible[i - 1]?.group && (
                  <p className="px-3 pt-2 pb-1 text-fg-muted">{option.group}</p>
                )}
                <CheckRow
                  checked={selected.includes(option.value)}
                  onChange={(on) =>
                    onChange(
                      on
                        ? [...selected, option.value]
                        : selected.filter((value) => value !== option.value),
                    )
                  }
                >
                  <span
                    className={cn(prop === "subject" && "font-semibold")}
                    title={
                      option.hint
                        ? `${option.label} - ${option.hint}`
                        : undefined
                    }
                  >
                    {option.label}
                    {option.hint && (
                      <span className="ml-2 font-normal text-fg-muted">
                        {option.hint}
                      </span>
                    )}
                  </span>
                </CheckRow>
              </Fragment>
            ))}
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-fg-muted">
                Nothing matches "{query}"
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** "Program first" or "Code A to Z" as a text menu button (D29). */
export function SortMenu({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  return (
    <Menu
      align="end"
      trigger={
        <Button variant="secondary">
          <span className="sr-only">Sort: </span>
          {SORTS.find((s) => s.key === sort)?.label}
          <ChevronDown aria-hidden className="text-fg-muted" />
        </Button>
      }
    >
      {SORTS.map((option) => (
        <MenuItem key={option.key} onSelect={() => onChange(option.key)}>
          <span className="flex w-4 shrink-0">
            {option.key === sort && <Check aria-hidden className="size-4" />}
          </span>
          {option.label}
          {option.key === sort && <span className="sr-only"> (selected)</span>}
        </MenuItem>
      ))}
    </Menu>
  );
}
