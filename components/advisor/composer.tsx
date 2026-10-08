"use client";

import {
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  type LucideIcon,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { type RefObject, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/lib/catalogue/client";
import { earnedCredits } from "@/lib/engine/credits";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { getProgram } from "@/lib/programs";

const NO_COURSES: Catalogue = new Map();

export type ContextKind = "profile" | "transcript" | "plan" | "course";

export const CONTEXT: Record<ContextKind, { label: string; icon: LucideIcon }> =
  {
    profile: { label: "Your profile", icon: UserRound },
    transcript: { label: "Your transcript", icon: FileText },
    plan: { label: "Your plan", icon: CalendarDays },
    course: { label: "A course", icon: BookOpen },
  };

const MODES = [
  { id: "balanced", label: "Balanced", hint: "Good for most questions" },
  { id: "thorough", label: "Thorough", hint: "Checks more before it answers" },
] as const;

const menuContent =
  "z-50 min-w-60 rounded-lg bg-card p-1 shadow-float outline-none";
const menuItem =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-subtle";
const toolButton =
  "flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground text-sm transition-[background-color,color] hover:bg-subtle hover:text-foreground data-[state=open]:bg-subtle data-[state=open]:text-foreground";

/** Credits earned, advanced standing included, using the catalogue for records that do not state them. */
function ProfileDetail({
  snapshot,
}: {
  snapshot: Snapshot | null | undefined;
}) {
  const programId = useProfileStore((state) => state.programId);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const catalogue = useCatalogue();

  const parts: string[] = [];
  const program = programId ? getProgram(programId) : undefined;
  if (program) parts.push(program.name);
  const credits =
    (snapshot
      ? earnedCredits(
          snapshot,
          catalogue.status === "ready" ? catalogue.catalogue : NO_COURSES,
        )
      : 0) + advancedStanding;
  if (credits > 0) parts.push(`${credits} credits`);

  return parts.length > 0 ? (
    <span className="truncate text-muted-foreground">{parts.join(" · ")}</span>
  ) : null;
}

export function Composer({
  value,
  onChange,
  onSend,
  textareaRef,
  attached,
  hasProfile,
  snapshot,
  onToggle,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  attached: ContextKind[];
  hasProfile: boolean;
  snapshot: Snapshot | null | undefined;
  onToggle: (kind: ContextKind) => void;
}) {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("balanced");
  const menuKinds = (Object.keys(CONTEXT) as ContextKind[]).filter(
    (kind) => hasProfile || kind !== "profile",
  );
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  // biome-ignore lint/correctness/useExhaustiveDependencies: grow or shrink whenever the text changes
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, textareaRef]);

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="rounded-xl bg-card shadow-float transition-shadow focus-within:shadow-[0_8px_24px_-6px_rgb(23_32_54/0.22),0_0_0_2px_var(--ring)]"
      >
        {attached.length > 0 && (
          <ul
            aria-label="Attached context"
            className="flex flex-wrap gap-2 px-4 pt-4"
          >
            {attached.map((kind) => {
              const { label, icon: Icon } = CONTEXT[kind];
              return (
                <li
                  key={kind}
                  className="flex h-8 max-w-full items-center gap-2 rounded-md bg-subtle pr-1 pl-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--border)]"
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="shrink-0 font-medium">{label}</span>
                  {kind === "profile" && <ProfileDetail snapshot={snapshot} />}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => onToggle(kind)}
                    className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-[background-color,color] hover:bg-muted hover:text-foreground"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label="Message the advisor"
          placeholder="Ask anything about your degree"
          className="block max-h-56 min-h-[3.75rem] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-base leading-6 outline-none placeholder:text-faint"
        />

        <div className="flex items-center px-3 pb-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Add context"
                className="size-8 data-[state=open]:bg-subtle data-[state=open]:text-foreground"
              >
                <Plus aria-hidden />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="start"
                sideOffset={8}
                className={menuContent}
              >
                <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">
                  Add context
                </DropdownMenu.Label>
                {menuKinds.map((kind) => {
                  const { label, icon: Icon } = CONTEXT[kind];
                  return (
                    <DropdownMenu.CheckboxItem
                      key={kind}
                      checked={attached.includes(kind)}
                      onCheckedChange={() => onToggle(kind)}
                      className={menuItem}
                    >
                      <Icon
                        aria-hidden
                        className="size-4 text-muted-foreground"
                      />
                      {label}
                      <DropdownMenu.ItemIndicator className="ml-auto">
                        <Check aria-hidden className="size-4" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.CheckboxItem>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <div className="ml-auto flex items-center gap-1.5">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Mode, ${current.label}`}
                  className={toolButton}
                >
                  {current.label}
                  <ChevronDown aria-hidden className="size-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="end"
                  sideOffset={8}
                  className={menuContent}
                >
                  <DropdownMenu.RadioGroup
                    value={mode}
                    onValueChange={(id) =>
                      setMode(MODES.find((m) => m.id === id)?.id ?? "balanced")
                    }
                  >
                    {MODES.map(({ id, label, hint }) => (
                      <DropdownMenu.RadioItem
                        key={id}
                        value={id}
                        className={menuItem}
                      >
                        <span className="grid">
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground text-xs">
                            {hint}
                          </span>
                        </span>
                        <DropdownMenu.ItemIndicator className="ml-auto">
                          <Check aria-hidden className="size-4" />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!value.trim()}
              className="size-8"
            >
              <ArrowUp aria-hidden strokeWidth={2.25} />
            </Button>
          </div>
        </div>
      </form>
      <p className="mt-3 text-center text-muted-foreground text-xs">
        The advisor can make mistakes. Check important details in the{" "}
        <Link
          href="/courses"
          className="underline underline-offset-2 hover:text-foreground"
        >
          course catalogue
        </Link>
        .
      </p>
    </div>
  );
}
