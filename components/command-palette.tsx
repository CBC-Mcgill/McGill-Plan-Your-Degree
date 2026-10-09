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
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses, searchCourses } from "@/lib/catalogue/search";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus } from "@/lib/engine/status";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { useSnapshot } from "@/lib/profile/use-snapshot";

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();
const setOpen = (value: boolean) => {
  if (value && !open && document.activeElement instanceof HTMLElement) {
    opener = document.activeElement;
  }
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

const noSubscribe = () => () => {};
/** "⌘K" on Apple platforms and "Ctrl K" elsewhere. The server and first paint use "⌘K". */
const useShortcut = () =>
  useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );

/** Words a query can start to reach a page. Apostrophes are ignored, so "whats next" works. */
const matches = (text: string, ...names: string[]) =>
  ` ${names.join(" ").toLowerCase().replaceAll("'", "")}`.includes(
    ` ${text.replaceAll("'", "")}`,
  );

const MAX_COURSES = 8;
const TAKEN = new Set(["completed", "covered", "in-progress"]);

const PAGES: {
  label: string;
  href: string;
  icon: LucideIcon;
  aliases?: string;
  soon?: true;
}[] = [
  { label: "Browse courses", href: "/courses", icon: Library },
  { label: "What's next", href: "/next", icon: Compass },
  { label: "Planner", href: "/plan", icon: CalendarRange },
  {
    label: "Profile",
    href: "/profile",
    icon: UserRound,
    aliases: "import transcript",
  },
  { label: "Advisor", href: "/advisor", icon: Sparkles, soon: true },
];

type Item =
  | {
      kind: "page";
      label: string;
      href: string;
      icon: LucideIcon;
      soon?: true;
    }
  | { kind: "course"; course: CourseSummary }
  | { kind: "action"; label: string; icon: LucideIcon; run: () => void };

/** The header's search bar. It is a button, so the catalogue stays unloaded until the palette opens. */
export function SearchBar({ className }: { className?: string }) {
  const shortcut = useShortcut();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        "flex h-8 w-52 items-center gap-2 rounded-md bg-subtle px-2.5 text-left text-faint shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-muted/60 max-[1120px]:w-48",
        className,
      )}
    >
      <Search aria-hidden className="size-4" strokeWidth={1.75} />
      <span className="flex-1 truncate text-[13px]">Search courses</span>
      <Kbd>{shortcut}</Kbd>
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
  const navigated = useRef(false);
  const index = useMemo(
    () =>
      catalogue.status === "ready"
        ? indexCourses(catalogue.catalogue.values())
        : [],
    [catalogue],
  );

  const text = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const courses = text
      ? searchCourses(index, text)
          .slice(0, MAX_COURSES)
          .map((course): Item => ({ kind: "course", course }))
      : [];
    const pages = PAGES.filter(
      (page) => !text || matches(text, page.label, page.aliases ?? ""),
    ).map((page): Item => ({ kind: "page", ...page }));
    const top = courses[0]?.kind === "course" ? courses[0].course : null;
    // A course the student has taken or is taking has nothing to add, and a query that names a page is not a course search.
    const first =
      top &&
      snapshot &&
      pages.length === 0 &&
      !TAKEN.has(courseStatus(top, snapshot).status)
        ? top
        : null;
    const nextTerm = planTermOptions([])[0];
    const actions: Item[] = [
      ...(!text || matches(text, "import transcript")
        ? [
            {
              kind: "page" as const,
              label: "Import transcript",
              href: "/profile",
              icon: FileUp,
            },
          ]
        : []),
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
    ];
    const pagesGroup = { title: "Pages", items: pages };
    const actionsGroup = { title: "Actions", items: actions };
    const coursesGroup = { title: "Courses", items: courses };
    // A page the query names comes first, otherwise the best course does.
    return (
      pages.length > 0
        ? [pagesGroup, actionsGroup, coursesGroup]
        : [coursesGroup, actionsGroup]
    ).filter((group) => group.items.length > 0);
  }, [text, index, snapshot]);

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
    if (item.kind === "action") return item.run();
    navigated.current = true;
    router.push(
      item.kind === "page"
        ? item.href
        : `/courses/${courseSlug(item.course.code)}`,
    );
  }

  const message = !text
    ? null
    : catalogue.status === "error"
      ? "Could not load courses"
      : catalogue.status === "loading"
        ? "Loading courses..."
        : flat.length === 0
          ? `No results for "${query.trim()}"`
          : null;

  return (
    <Dialog.Root open onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-foreground/30" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const main = document.getElementById("main");
            const back =
              navigated.current || !opener?.isConnected ? main : opener;
            back?.focus();
          }}
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
              aria-expanded={flat.length > 0}
              aria-controls={flat.length ? listId : undefined}
              aria-autocomplete="list"
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
          {flat.length > 0 && (
            <div
              ref={list}
              id={listId}
              role="listbox"
              aria-label="Results"
              className="max-h-[400px] overflow-y-auto p-2"
            >
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
                          selected && "option-active",
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
                            {item.kind === "page" && item.soon && (
                              <Badge>Soon</Badge>
                            )}
                            {selected && <Kbd aria-hidden>↵</Kbd>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <p
            role="status"
            className={cn(
              "px-3 text-center text-muted-foreground empty:hidden",
              flat.length > 0 ? "pt-1 pb-3 text-[13px]" : "py-8",
            )}
          >
            {message}
          </p>
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
