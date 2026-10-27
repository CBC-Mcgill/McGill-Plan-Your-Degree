"use client";

import { cn } from "cn";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePhone } from "@/components/profile/layout";
import { controlStyles, FieldLabel } from "@/components/ui/field";
import { type Definition, GLOSSARY } from "@/lib/glossary";
import { useProgramIndex } from "@/lib/programs/client";
import { isMinor } from "@/lib/programs/minor";
import type { ProgramSummary } from "@/lib/programs/types";

const NO_PROGRAMS: ProgramSummary[] = [];

type Kind = "program" | "second" | "extra";

/** The words around the list for each kind of field. */
const COPY: Record<
  Kind,
  {
    label: string;
    placeholder: string;
    none: string;
    list: string;
    noun: string;
  }
> = {
  program: {
    label: "Program",
    placeholder: "Choose a program",
    none: "My program isn't listed",
    list: "Programs",
    noun: "program",
  },
  second: {
    label: GLOSSARY.second.label,
    placeholder: "None",
    none: "None",
    list: "Minors and programs",
    noun: "program",
  },
  extra: {
    label: "Minor",
    placeholder: "Choose a minor",
    none: "None",
    list: "Minors",
    noun: "minor",
  },
};

/** Lowercase letters and digits only, so "bsc" finds B.Sc. and "coop" finds Co-op. */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "");

const labelOf = (program: ProgramSummary) =>
  `${program.name} (${program.degree})`;

/** Programs whose name, degree, faculty or level hold every word of the query, grouped by faculty. `suffix` follows each faculty's name, as in "Arts minors". */
function search(programs: ProgramSummary[], query: string, suffix = "") {
  const words = plain(query).split(" ").filter(Boolean);
  const groups = new Map<string, ProgramSummary[]>();
  for (const program of programs) {
    const text = plain(
      `${program.name} ${program.degree} ${program.faculty} ${program.level ?? ""}`,
    );
    if (!words.every((word) => text.includes(word))) continue;
    groups.set(program.faculty, [
      ...(groups.get(program.faculty) ?? []),
      program,
    ]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([faculty, list]) => ({
      faculty: faculty + suffix,
      programs: list.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * A searchable program list: non-minors for the program, undergraduate programs for the second, minors for the extra.
 * The empty choice is "My program isn't listed" for a program the catalogue does not have, and "None" for the second. `label` replaces the field's own, and `info` makes the label a `Term`.
 */
export function ProgramCombobox({
  value,
  onChange,
  kind = "program",
  others = [],
  label,
  info,
  autoFocus,
}: {
  value: string | null;
  onChange: (programId: string | null, program: ProgramSummary | null) => void;
  kind?: Kind;
  others?: readonly (string | null)[];
  label?: string;
  info?: Definition;
  /** Focuses the field on mount. */
  autoFocus?: boolean;
}) {
  const copy = COPY[kind];
  const index = useProgramIndex();
  const programs = useMemo(
    () =>
      index.status === "ready"
        ? index.programs.filter(
            (program) =>
              !others.includes(program.id) &&
              (kind === "program"
                ? !isMinor(program)
                : !program.level && (kind === "second" || isMinor(program))),
          )
        : NO_PROGRAMS,
    [index, kind, others],
  );
  const chosen = programs.find((program) => program.id === value);
  const listId = useId();
  const inputId = useId();
  const infoId = useId();
  const field = useRef<HTMLSpanElement>(null);
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  // Null shows the chosen program, so the field only holds what the student typed.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const groups = useMemo(
    () =>
      kind === "extra"
        ? search(programs, query ?? "", " minors")
        : kind === "second"
          ? [
              ...search(programs.filter(isMinor), query ?? "", " minors"),
              ...search(
                programs.filter((program) => !isMinor(program)),
                query ?? "",
              ),
            ]
          : [
              ...search(
                programs.filter((program) => !program.level),
                query ?? "",
              ),
              ...search(
                programs.filter((program) => program.level),
                query ?? "",
                " graduate programs",
              ),
            ],
    [programs, query, kind],
  );
  // The last choice is always the empty one.
  const options = [...groups.flatMap((group) => group.programs), null];
  const optionId = (position: number) => `${listId}-${position}`;

  useEffect(() => {
    if (open) {
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active, listId]);

  function show() {
    if (open) return;
    const at = options.findIndex((program) => program?.id === value);
    setActive(at < 0 ? 0 : at);
    setOpen(true);
    // On a phone the keyboard takes the bottom half, so the field moves up to leave the list room.
    if (phone) field.current?.scrollIntoView({ block: "start" });
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(program: ProgramSummary | null) {
    onChange(program?.id ?? null, program);
    close();
  }

  const message =
    index.status === "loading"
      ? `Loading ${copy.noun}s`
      : index.status === "error"
        ? `Could not load the ${copy.noun}s`
        : groups.length === 0
          ? `No ${copy.noun} matches`
          : null;

  return (
    <Popover.Root open={open} onOpenChange={(next) => !next && close()}>
      <div className="grid gap-2">
        <FieldLabel
          htmlFor={inputId}
          label={label ?? copy.label}
          info={info}
          describedBy={infoId}
        />
        <Popover.Anchor asChild>
          <span ref={field} className="relative max-md:scroll-mt-12">
            <input
              id={inputId}
              // biome-ignore lint/a11y/noAutofocus: only set right after the student asks for the field
              autoFocus={autoFocus}
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={open ? optionId(active) : undefined}
              aria-describedby={info && infoId}
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.placeholder}
              value={query ?? (chosen ? labelOf(chosen) : "")}
              onFocus={(event) => {
                event.currentTarget.select();
                show();
              }}
              onClick={show}
              onBlur={close}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!open) return show();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive(
                    (at) => (at + step + options.length) % options.length,
                  );
                } else if (
                  event.key === "Enter" &&
                  open &&
                  index.status !== "loading"
                ) {
                  event.preventDefault();
                  choose(options[active] ?? null);
                }
              }}
              className={cn(controlStyles, "w-full text-ellipsis pr-9")}
            />
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
            />
          </span>
        </Popover.Anchor>
      </div>
      <Popover.Portal>
        <Popover.Content
          role="presentation"
          align="start"
          sideOffset={4}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (field.current?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
          // Keeps focus in the field while a click or a scrollbar drag lands on the list.
          onMouseDown={(event) => event.preventDefault()}
          className="z-[85] max-h-[min(400px,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) overflow-y-auto rounded-lg bg-bg p-1 shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none max-md:max-h-[min(45svh,var(--radix-popover-content-available-height))] max-md:w-[calc(100vw-2rem)]"
        >
          <div id={listId} role="listbox" aria-label={copy.list}>
            {message && <p className="px-3 py-2.5 text-fg-muted">{message}</p>}
            {groups.map((group) => (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot sit inside a listbox
              <div key={group.faculty} role="group" aria-label={group.faculty}>
                <p
                  aria-hidden
                  className="sticky top-0 z-10 bg-bg px-3 pt-2 pb-1 text-fg-muted"
                >
                  {group.faculty}
                </p>
                {group.programs.map((program) => (
                  <Option
                    key={program.id}
                    id={optionId(options.indexOf(program))}
                    active={options[active] === program}
                    selected={program.id === value}
                    onActivate={() => setActive(options.indexOf(program))}
                    onChoose={() => choose(program)}
                  >
                    {/* A phone wraps the name, since two programs can share their first words. */}
                    <span className="min-w-0 flex-1 truncate max-md:whitespace-normal">
                      {program.name}
                    </span>
                    <span className="shrink-0 font-normal text-fg-muted">
                      {program.degree}
                    </span>
                  </Option>
                ))}
              </div>
            ))}
            <div className="mt-1">
              <Option
                id={optionId(options.length - 1)}
                active={active === options.length - 1}
                selected={false}
                onActivate={() => setActive(options.length - 1)}
                onChoose={() => choose(null)}
              >
                {copy.none}
              </Option>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Option({
  id,
  active,
  selected,
  onActivate,
  onChoose,
  children,
}: {
  id: string;
  active: boolean;
  selected: boolean;
  onActivate: () => void;
  onChoose: () => void;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the field and aria-activedescendant points here
    // biome-ignore lint/a11y/useKeyWithClickEvents: the field handles the keys
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onMouseMove={onActivate}
      onClick={onChoose}
      className={cn(
        "flex h-10 scroll-mt-8 cursor-pointer items-center gap-2 rounded-md px-3 max-md:h-auto max-md:min-h-11 max-md:py-2.5",
        active && "selected",
      )}
    >
      <Check
        aria-hidden
        strokeWidth={2}
        className={cn("size-4 shrink-0", !selected && "invisible")}
      />
      {children}
    </div>
  );
}
