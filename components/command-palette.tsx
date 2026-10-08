"use client";

import { cn } from "cn";
import {
  CalendarRange,
  Compass,
  FileUp,
  Library,
  type LucideIcon,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { StatusIcon } from "@/components/status";
import { Kbd } from "@/components/ui/kbd";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses, searchCourses } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus } from "@/lib/engine/status";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { useSnapshot } from "@/lib/profile/use-snapshot";

let open = false;
const listeners = new Set<() => void>();
const setOpen = (value: boolean) => {
  open = value;
  for (const listener of listeners) listener();
};
const openCommandPalette = () => setOpen(true);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const useIsOpen = () =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );

const MAX_COURSES = 8;
const TAKEN = new Set(["completed", "covered", "in-progress"]);

const PAGES: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Browse courses", href: "/courses", icon: Library },
  { label: "What's next", href: "/next", icon: Compass },
  { label: "Planner", href: "/plan", icon: CalendarRange },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Advisor", href: "/advisor", icon: Sparkles },
];

type Item =
  | { kind: "page"; label: string; href: string; icon: LucideIcon }
  | { kind: "course"; course: CourseSummary }
  | { kind: "action"; label: string; icon: LucideIcon; run: () => void };

/** The header's search bar. It is a button, so the catalogue stays unloaded until the palette opens. */
export function SearchBar({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        "flex h-8 w-52 items-center gap-2 rounded-md bg-subtle px-2.5 text-left text-faint shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-muted/60 max-[1120px]:w-44",
        className,
      )}
    >
      <Search aria-hidden className="size-4" strokeWidth={1.75} />
      <span className="flex-1 truncate text-[13px]">Search courses</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}

/** Command palette: pages, live course search and actions in one keyboard-first dialog. Press ⌘K or Ctrl+K anywhere. */
export function CommandPalette() {
  const isOpen = useIsOpen();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mounted only while open, so nobody downloads the catalogue for a palette they never use.
  return isOpen ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const catalogue = useCatalogue();
  const snapshot = useSnapshot();
  const list = useRef<HTMLDivElement>(null);
  const index = useMemo(
    () =>
      catalogue.status === "ready"
        ? indexCourses(catalogue.catalogue.values())
        : [],
    [catalogue],
  );

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    const courses = text
      ? searchCourses(index, text)
          .slice(0, MAX_COURSES)
          .map((course): Item => ({ kind: "course", course }))
      : [];
    const pages = PAGES.filter((page) =>
      page.label.toLowerCase().includes(text),
    ).map((page): Item => ({ kind: "page", ...page }));
    const top = courses[0]?.kind === "course" ? courses[0].course : null;
    // A course the student has taken or is taking has nothing to add.
    const first =
      top && snapshot && !TAKEN.has(courseStatus(top, snapshot).status)
        ? top
        : null;
    const nextTerm = planTermOptions([])[0];
    const actions: Item[] = [
      ...(first && nextTerm && snapshot
        ? [
            {
              kind: "action" as const,
              label: `Add ${first.code} to ${termLabel(nextTerm)}`,
              icon: Plus,
              run: () => addWithUndo(nextTerm, first.code),
            },
          ]
        : []),
      ...(!text || "import transcript".includes(text)
        ? [
            {
              kind: "action" as const,
              label: "Import transcript",
              icon: FileUp,
              run: () => router.push("/profile"),
            },
          ]
        : []),
    ];
    return [
      { title: "Courses", items: courses },
      { title: "Pages", items: pages },
      { title: "Actions", items: actions },
    ].filter((group) => group.items.length > 0);
  }, [query, index, snapshot, router]);

  const flat = groups.flatMap((group) => group.items);
  const optionId = (position: number) => `${listId}-${position}`;

  // Arrow keys move the highlight, so keep it on screen.
  useEffect(() => {
    list.current
      ?.querySelector(`[id="${listId}-${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function run(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    if (item.kind === "page") router.push(item.href);
    else if (item.kind === "course") {
      router.push(`/courses/${courseSlug(item.course.code)}`);
    } else item.run();
  }

  return (
    <Dialog.Root open onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-foreground/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[15vh] left-1/2 z-[90] w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl bg-card shadow-float"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((value) =>
                flat.length ? (value + step + flat.length) % flat.length : 0,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(flat[active]);
            }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex h-12 items-center gap-3 border-border border-b px-4">
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={flat.length ? optionId(active) : undefined}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder="Search courses or jump to a page"
              aria-label="Search courses or jump to a page"
              className="h-full flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint"
            />
            <Kbd>esc</Kbd>
          </div>
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="max-h-[400px] overflow-y-auto p-2"
          >
            {groups.length === 0 && (
              <p className="px-3 py-8 text-center text-muted-foreground">
                {catalogue.status === "loading"
                  ? "Loading courses..."
                  : `No results for "${query.trim()}"`}
              </p>
            )}
            {groups.map((group) => (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot sit inside a listbox
              <div
                key={group.title}
                role="group"
                aria-label={group.title}
                className="mb-1 last:mb-0"
              >
                <p
                  aria-hidden
                  className="px-3 pt-2 pb-1 font-medium text-muted-foreground text-xs"
                >
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const position = flat.indexOf(item);
                  const selected = position === active;
                  return (
                    // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the input and aria-activedescendant points here
                    // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the keys
                    <div
                      key={
                        item.kind === "course" ? item.course.code : item.label
                      }
                      id={optionId(position)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(position)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left",
                        selected &&
                          "bg-subtle shadow-[inset_0_0_0_1px_var(--border)]",
                      )}
                    >
                      {item.kind === "course" ? (
                        <>
                          {snapshot && (
                            <StatusIcon
                              status={
                                courseStatus(item.course, snapshot).status
                              }
                            />
                          )}
                          <span className="w-[76px] shrink-0 font-semibold tabular-nums">
                            {item.course.code}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.course.title}
                          </span>
                          <span className="text-[13px] text-muted-foreground tabular-nums">
                            {item.course.credits ?? "?"} cr
                          </span>
                        </>
                      ) : (
                        <>
                          <item.icon
                            aria-hidden
                            className="size-4 text-muted-foreground"
                            strokeWidth={1.75}
                          />
                          <span className="flex-1">{item.label}</span>
                          {selected && <Kbd>↵</Kbd>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex h-9 items-center gap-4 border-border border-t bg-subtle px-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> to open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd> to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
