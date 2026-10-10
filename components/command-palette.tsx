"use client";

import { cn } from "cn";
import {
  CalendarPlus,
  CalendarRange,
  Compass,
  FileUp,
  Library,
  type LucideIcon,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CourseCode } from "@/components/course-code";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { STATUS, StatusIcon } from "@/components/status";
import { Kbd } from "@/components/ui/kbd";
import { useCatalogue } from "@/lib/catalogue/client";
import { indexCourses, searchCourses } from "@/lib/catalogue/search";
import { codeFromSlug, courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { nextView } from "@/lib/engine/next-view";
import { courseStatus } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  planTermOptions,
  termLabel,
} from "@/lib/profile/term-options";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import { recentCourses, rememberCourse } from "@/lib/recent-courses";

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
export const openCommandPalette = () => setOpen(true);

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
const MAX_SUGGESTED = 3;
const FADE =
  "transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none";
const NOTHING_TO_ADD = new Set([
  "completed",
  "covered",
  "in-progress",
  "planned",
]);

type Page = {
  label: string;
  href: string;
  icon: LucideIcon;
  aliases?: string;
  soon?: true;
};

const BROWSE: Page = {
  label: "Browse courses",
  href: "/courses",
  icon: Library,
};
const NEXT: Page = {
  label: "What's next",
  href: "/next",
  icon: Compass,
  aliases: "requirements where courses count degree audit",
};
const PLANNER: Page = { label: "Planner", href: "/plan", icon: CalendarRange };
const PROFILE: Page = {
  label: "Profile",
  href: "/profile",
  icon: UserRound,
  aliases: "import transcript",
};
const ADVISOR: Page = {
  label: "Advisor",
  href: "/advisor",
  icon: Sparkles,
  aliases: "preview",
  soon: true,
};
const IMPORT: Page = {
  label: COPY.importTranscript,
  href: "/profile",
  icon: FileUp,
  aliases: "profile",
};

type Item =
  | ({ kind: "page" } & Page)
  | { kind: "course"; course: CourseSummary }
  | { kind: "action"; label: string; run: () => void };

const asItem = (course: CourseSummary): Item => ({ kind: "course", course });

/** The header's search bar. It is a button, so the catalogue stays unloaded until the palette opens. */
export function SearchBar() {
  const shortcut = useShortcut();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex h-10 w-full items-center gap-2 rounded-md bg-bg pr-2 pl-3 text-left text-fg-muted shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-tint"
    >
      <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">Search courses</span>
      <Kbd>{shortcut}</Kbd>
    </button>
  );
}

/** Command palette: recent and suggested courses, pages, live course search and actions in one keyboard-first dialog. Press ⌘K or Ctrl+K anywhere. */
export function CommandPalette() {
  const isOpen = useIsOpen();
  const pathname = usePathname();

  // The layout keeps the palette on every page, so it notes each course page for the Recent group.
  useEffect(() => {
    const slug = /^\/courses\/([^/]+)$/.exec(pathname)?.[1];
    if (slug) rememberCourse(codeFromSlug(slug));
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }
      event.preventDefault();
      setOpen(!open);
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
  const imported = useProfileStore((state) => state.records.length > 0);
  const programId = useProfileStore((state) => state.programId);
  const entry = useProfileStore((state) => state.entry);
  const program = useProgram(programId);
  const [recent] = useState(recentCourses);
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
  const [nextTerm] = useState(() => planTermOptions([])[0] ?? currentTerm());

  // Required courses open next term that the plan does not hold yet, as What's next lists them.
  const suggested = useMemo(() => {
    if (catalogue.status !== "ready" || !program || !snapshot) return [];
    return nextView(catalogue.catalogue, snapshot, nextTerm, program, entry)
      .mustTake.flatMap((item) => ("oneOf" in item ? item.oneOf : [item]))
      .filter(
        ({ course, reason }) =>
          !reason &&
          !snapshot.planned.has(course.code) &&
          !recent.includes(course.code),
      )
      .slice(0, MAX_SUGGESTED)
      .map(({ course }) => asItem(course));
  }, [catalogue, program, snapshot, nextTerm, entry, recent]);

  // Hold the first list until recent and suggested courses are in, so rows never shift under the highlight.
  const settling =
    !text &&
    (recent.length > 0 || programId !== null) &&
    (catalogue.status === "loading" || program === undefined);

  const groups = useMemo(() => {
    if (settling) return [];
    const courses = text
      ? searchCourses(index, text).slice(0, MAX_COURSES).map(asItem)
      : [];
    const pages = (
      imported
        ? [BROWSE, NEXT, PLANNER, PROFILE, ADVISOR]
        : [BROWSE, NEXT, PLANNER, ADVISOR, IMPORT]
    )
      .filter((page) => !text || matches(text, page.label, page.aliases ?? ""))
      .map((page): Item => ({ kind: "page", ...page }));
    const top = courses[0]?.kind === "course" ? courses[0].course : null;
    // A course the student has taken, is taking or planned has nothing to add, and a query that names a page is not a course search.
    const first =
      top &&
      snapshot &&
      pages.length === 0 &&
      !NOTHING_TO_ADD.has(courseStatus(top, snapshot).status)
        ? top
        : null;
    const actions: Item[] =
      first && snapshot
        ? [
            {
              kind: "action",
              label: `Add ${first.code} to ${termLabel(nextTerm)}`,
              run: () => addWithUndo(nextTerm, first.code),
            },
          ]
        : [];
    const pagesGroup = { title: "Pages", items: pages };
    const actionsGroup = { title: "Actions", items: actions };
    const coursesGroup = { title: "Courses", items: courses };
    const recentGroup = {
      title: "Recent",
      items:
        catalogue.status === "ready"
          ? recent.flatMap((code) => {
              const course = catalogue.catalogue.get(code);
              return course ? [asItem(course)] : [];
            })
          : [],
    };
    const suggestedGroup = {
      title: `Suggested for ${termLabel(nextTerm)}`,
      items: suggested,
    };
    // Before typing: recent and suggested courses, then pages. After, a page the query names comes first, otherwise the best course does.
    return (
      !text
        ? [recentGroup, suggestedGroup, pagesGroup]
        : pages.length > 0
          ? [pagesGroup, actionsGroup, coursesGroup]
          : [coursesGroup, actionsGroup]
    ).filter((group) => group.items.length > 0);
  }, [
    settling,
    text,
    index,
    snapshot,
    imported,
    catalogue,
    recent,
    suggested,
    nextTerm,
  ]);

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
        <Dialog.Overlay className={cn("fixed inset-0 z-[90] bg-scrim", FADE)} />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const main = document.getElementById("main");
            const back =
              navigated.current || !opener?.isConnected ? main : opener;
            back?.focus();
          }}
          className={cn(
            "fixed top-[120px] left-1/2 z-[90] w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-lg bg-bg text-fg shadow-float",
            // A phone gets the whole screen, like its own search.
            "max-md:inset-0 max-md:flex max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:flex-col max-md:rounded-none",
            FADE,
          )}
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
          <div className="flex h-14 items-center gap-3 border-line border-b px-4">
            <Search aria-hidden className="size-4 shrink-0 text-fg-muted" />
            <input
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={flat.length ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={flat.length ? optionId(active) : undefined}
              aria-keyshortcuts="ArrowUp ArrowDown Enter Escape"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder="Search courses or jump to a page"
              aria-label="Search courses or jump to a page"
              className="h-full min-w-0 flex-1 bg-transparent text-fg text-lg outline-none placeholder:text-fg-muted"
            />
            <Kbd aria-hidden className="max-md:hidden">
              esc
            </Kbd>
            <Dialog.Close className="-mr-2 h-11 rounded-md px-2 font-semibold text-fg-muted md:hidden">
              Cancel
            </Dialog.Close>
          </div>
          {flat.length > 0 && (
            <div
              ref={list}
              id={listId}
              role="listbox"
              aria-label="Results"
              className="max-h-[min(520px,calc(100dvh-240px))] overflow-y-auto p-2 max-md:max-h-none max-md:flex-1"
            >
              {groups.map((group, i) => (
                // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot sit inside a listbox
                <div key={group.title} role="group" aria-label={group.title}>
                  <p
                    aria-hidden
                    className={cn(
                      "px-3 pb-1 text-fg-muted",
                      i === 0 ? "pt-1" : "pt-3",
                    )}
                  >
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const position = flat.indexOf(item);
                    const selected = position === active;
                    const status =
                      item.kind === "course" &&
                      snapshot &&
                      courseStatus(item.course, snapshot).status;
                    const Icon =
                      item.kind === "page" ? item.icon : CalendarPlus;
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
                          "flex h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left max-md:h-12",
                          selected && "selected",
                        )}
                      >
                        {item.kind === "course" ? (
                          <>
                            <span className="flex w-4 shrink-0 justify-center">
                              {status && <StatusIcon status={status} />}
                            </span>
                            <span className="w-24 shrink-0 font-semibold tabular-nums">
                              <CourseCode code={item.course.code} />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-normal">
                              {item.course.title}
                            </span>
                            {status && (
                              <span
                                className="shrink-0 font-normal"
                                style={{ color: STATUS[status].text }}
                              >
                                {STATUS[status].label}
                              </span>
                            )}
                            <span className="min-w-9 shrink-0 text-right font-normal text-fg-muted tabular-nums">
                              {COPY.rowCredits(item.course)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Icon
                              aria-hidden
                              className="size-4 shrink-0 text-fg-muted"
                              strokeWidth={1.75}
                            />
                            <span className="flex-1">{item.label}</span>
                            {item.kind === "page" && item.soon && (
                              <span
                                className={cn(
                                  "rounded-[5px] px-1.5 font-normal text-[11px] text-fg-muted leading-[18px]",
                                  selected ? "bg-bg" : "bg-tint",
                                )}
                              >
                                Soon
                              </span>
                            )}
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
              "px-4 text-center text-fg-muted empty:hidden",
              flat.length > 0 ? "pb-3" : "py-6",
            )}
          >
            {message}
          </p>
          <div
            aria-hidden
            className="flex h-10 items-center gap-5 border-line border-t px-4 text-fg-muted max-md:hidden"
          >
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              Move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              Open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              Close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
