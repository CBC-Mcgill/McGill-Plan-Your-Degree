"use client";

import { cn } from "cn";
import {
  CalendarRange,
  Compass,
  GitFork,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "radix-ui";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  CONTEXT,
  Composer,
  type ContextKind,
} from "@/components/advisor/composer";
import { AssistantMessage, UserMessage } from "@/components/advisor/message";
import { Sidebar } from "@/components/advisor/sidebar";
import { Spark } from "@/components/advisor/spark";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SUGGESTIONS: { title: string; line: string; icon: LucideIcon }[] = [
  {
    title: "Plan my next term",
    line: "Pick courses that fit your program.",
    icon: CalendarRange,
  },
  {
    title: "Am I on track to graduate?",
    line: "See what is left in your program.",
    icon: GraduationCap,
  },
  {
    title: "Find electives I'd enjoy",
    line: "Ideas that still count for your degree.",
    icon: Compass,
  },
  {
    title: "Explain a prerequisite chain",
    line: "See which courses lead to the one you want.",
    icon: GitFork,
  },
];

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Null on the server and during hydration, so the server HTML never shows the wrong time of day. */
function useGreeting(): string | null {
  return useSyncExternalStore(
    () => () => {},
    timeOfDayGreeting,
    () => null,
  );
}

const scrollToEnd = (el: HTMLElement | null) => {
  el?.scrollIntoView({ block: "end" });
};

export function AdvisorChat() {
  const snapshot = useSnapshot();
  const greeting = useGreeting();
  const [turns, setTurns] = useState<{ id: number; prompt: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [overrides, setOverrides] = useState<
    Partial<Record<ContextKind, boolean>>
  >({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasProfile = Boolean(snapshot);
  const isAttached = (kind: ContextKind) =>
    overrides[kind] ?? (kind === "profile" && hasProfile);
  const attached = (Object.keys(CONTEXT) as ContextKind[]).filter(isAttached);
  const empty = turns.length === 0;

  function send() {
    const prompt = draft.trim();
    if (!prompt) return;
    setTurns([...turns, { id: turns.length, prompt }]);
    setDraft("");
  }

  function newChat() {
    setTurns([]);
    setDraft("");
    setOverrides({});
    textareaRef.current?.focus();
  }

  function suggest(title: string) {
    setDraft(title);
    textareaRef.current?.focus();
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-[36rem]">
        <Sidebar onNewChat={newChat} />
        <section
          aria-label="Advisor chat"
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            empty && "justify-center pb-12",
          )}
        >
          {empty ? (
            <div className="mx-auto w-full max-w-3xl px-6 pb-8">
              <h1
                className={cn(
                  "flex items-center justify-center gap-3.5 font-normal font-serif font-stretch-normal text-5xl tracking-normal transition-opacity duration-300 motion-reduce:transition-none",
                  greeting ? "opacity-100" : "opacity-0",
                )}
              >
                <Spark className="size-9 text-primary" />
                {greeting ?? "Hello"}
              </h1>
              <p className="mt-3 text-center text-base text-muted-foreground">
                Ask about your courses, requirements, or what to take next.
              </p>
            </div>
          ) : (
            <h1 className="sr-only">Advisor</h1>
          )}

          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className={cn(
              empty
                ? "sr-only"
                : "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            )}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
              {turns.map(({ id, prompt }) => (
                <div key={id} className="flex flex-col gap-6">
                  <UserMessage text={prompt} />
                  <AssistantMessage prompt={prompt} />
                </div>
              ))}
              {!empty && <div key={turns.length} ref={scrollToEnd} />}
            </div>
          </div>

          <motion.div
            layout="position"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "mx-auto w-full max-w-3xl px-6",
              !empty && "pt-2 pb-4",
            )}
          >
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={send}
              textareaRef={textareaRef}
              attached={attached}
              hasProfile={hasProfile}
              snapshot={snapshot}
              onToggle={(kind) =>
                setOverrides({ ...overrides, [kind]: !isAttached(kind) })
              }
            />
          </motion.div>

          {empty && (
            <ul className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 px-6">
              {SUGGESTIONS.map(({ title, line, icon: Icon }) => (
                <li key={title}>
                  <button
                    type="button"
                    onClick={() => suggest(title)}
                    className="flex h-full w-full items-start gap-3 rounded-lg bg-card p-4 text-left shadow-card transition-colors hover:bg-subtle"
                  >
                    <Icon
                      aria-hidden
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span className="grid gap-0.5">
                      <span className="font-semibold">{title}</span>
                      <span className="text-[13px] text-muted-foreground leading-[18px]">
                        {line}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Tooltip.Provider>
  );
}
