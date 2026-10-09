"use client";

import { cn } from "cn";
import { ArrowUpDown, Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { Checkbox, DropdownMenu, Popover } from "radix-ui";
import type * as React from "react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { compactControlStyles } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import {
  chipText,
  type Option,
  PROP_LABEL,
  type Prop,
  type SortKey,
} from "@/lib/engine/browse";

const FLOAT = "z-[85] rounded-lg bg-card shadow-float outline-none";
const MENU_ITEM =
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-[13px] outline-none data-[disabled]:text-faint data-[highlighted]:bg-subtle";
const PLURAL: Partial<Record<Prop, string>> = {
  subject: "subjects",
  faculty: "faculties",
};
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "code", label: "Code, A to Z" },
  { key: "level", label: "Level, low to high" },
  { key: "credits", label: "Credits, high to low" },
];

/** `shortcut` is the key that focuses the field, shown while it is empty. */
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
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
          compactControlStyles,
          "w-full pr-8 pl-9 text-sm hover:shadow-[inset_0_0_0_1px_var(--faint)] [&::-webkit-search-cancel-button]:hidden",
        )}
        {...props}
      />
      {shortcut && !value && (
        <Kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
        >
          {shortcut}
        </Kbd>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-subtle hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/** Chip that opens a popover: the label and a chevron while empty, the value only once set. */
function FilterChip({
  label,
  value,
  onClear,
  ...props
}: Omit<
  React.ComponentProps<typeof Chip>,
  "active" | "onRemove" | "children"
> & {
  label: string;
  value?: string;
  onClear?: () => void;
}) {
  return (
    <Chip
      active={Boolean(value)}
      onRemove={onClear}
      // biome-ignore lint/a11y/useValidAriaValues: a popover trigger is not a toggle
      aria-pressed={undefined}
      aria-label={value ? `${label}: ${value}` : undefined}
      title={value}
      className="max-w-64"
      {...props}
    >
      <span className="truncate">{value ?? label}</span>
      {!value && <ChevronDown aria-hidden strokeWidth={2} />}
    </Chip>
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
    <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-[13px] hover:bg-subtle">
      <Checkbox.Root
        data-nav
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-card shadow-[inset_0_0_0_1.5px_var(--border-strong)] data-[state=checked]:bg-ring data-[state=checked]:shadow-none"
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

/** One filter: a chip that opens a checkbox list, with a search field when the list is long. */
export function FilterPopover({
  prop,
  options,
  selected,
  onChange,
  onClear,
  open,
  onOpenChange,
}: {
  prop: Prop;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  onClear?: () => void;
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
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <FilterChip
          label={PROP_LABEL[prop]}
          value={selected.length ? chipText(prop, selected) : undefined}
          onClear={onClear}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onKeyDown={navKeys}
          className={cn(FLOAT, prop === "faculty" ? "w-[380px]" : "w-[264px]")}
        >
          {searchable && (
            <div className="flex h-10 items-center gap-2 border-border border-b px-3 focus-within:border-ring">
              <Search
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                data-nav
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${noun}`}
                aria-label={`Search ${noun}`}
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
          )}
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {!searchable && (
              <p className="px-2 pt-1 pb-1.5 font-medium text-[12px] text-muted-foreground">
                {prop === "term" ? "Offered in" : PROP_LABEL[prop]}
              </p>
            )}
            {visible.map((option, i) => (
              <Fragment key={option.value}>
                {option.group && option.group !== visible[i - 1]?.group && (
                  <p className="px-2 pt-2 pb-1 font-medium text-[12px] text-muted-foreground first:pt-1">
                    {option.group}
                  </p>
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
                    className={cn(prop === "subject" && "font-medium")}
                    title={
                      option.hint
                        ? `${option.label} - ${option.hint}`
                        : undefined
                    }
                  >
                    {option.label}
                    {option.hint && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                  </span>
                </CheckRow>
              </Fragment>
            ))}
            {visible.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                Nothing matches "{query}"
              </p>
            )}
          </div>
          <div className="flex h-10 items-center justify-between border-border border-t pr-2 pl-3">
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {selected.length
                ? `${selected.length} selected`
                : "None selected"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Lists the filters that have no chip yet. Picking one adds its chip and opens it. */
export function AddFilterMenu({
  props,
  onPick,
}: {
  props: Prop[];
  onPick: (prop: Prop) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" className="shrink-0">
          <Plus aria-hidden strokeWidth={1.75} />
          Add filter
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(FLOAT, "w-44 p-1")}
        >
          {props.map((prop) => (
            <DropdownMenu.Item
              key={prop}
              className={MENU_ITEM}
              onSelect={() => onPick(prop)}
            >
              {PROP_LABEL[prop]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SortMenu({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const current = SORTS.find((s) => s.key === sort)?.label;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary">
          <ArrowUpDown aria-hidden strokeWidth={1.75} />
          Sort
          <span className="text-muted-foreground">{current}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(FLOAT, "w-[220px] p-1")}
        >
          <DropdownMenu.Label className="px-2 pt-1.5 pb-1 font-medium text-[12px] text-muted-foreground">
            Sort by
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={sort}
            onValueChange={(value) => onChange(value as SortKey)}
          >
            {SORTS.map((option) => (
              <DropdownMenu.RadioItem
                key={option.key}
                value={option.key}
                className={cn(MENU_ITEM, "pl-7")}
              >
                <DropdownMenu.ItemIndicator className="absolute left-2">
                  <Check aria-hidden className="size-3.5" strokeWidth={2.25} />
                </DropdownMenu.ItemIndicator>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
