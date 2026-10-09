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
import { type RefObject, useLayoutEffect } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import { earnedCredits } from "@/lib/engine/credits";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { useProgram } from "@/lib/programs/client";

const NO_COURSES: Catalogue = new Map();

export type ContextKind = "profile" | "transcript" | "plan" | "course";

export const CONTEXT: Record<ContextKind, { label: string; icon: LucideIcon }> =
  {
    profile: { label: "Your profile", icon: UserRound },
    transcript: { label: "Your transcript", icon: FileText },
    plan: { label: "Your plan", icon: CalendarDays },
    course: { label: "A course", icon: BookOpen },
  };

const menuItem =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[color-mix(in_oklab,var(--ring)_10%,white)] data-[highlighted]:shadow-[inset_2px_0_0_var(--ring)]";
const iconButton =
  "grid size-8 place-items-center rounded-md transition-[background-color,box-shadow,translate] duration-100 motion-reduce:transition-none [&_svg]:size-4";

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
  const program = useProgram(programId);
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
    <span className="truncate text-fg-muted">{parts.join(" · ")}</span>
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
  const menuKinds = (Object.keys(CONTEXT) as ContextKind[]).filter(
    (kind) => hasProfile || kind !== "profile",
  );

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
        className="rounded-[16px] bg-bg shadow-float transition-shadow focus-within:shadow-[0_8px_24px_-6px_rgb(23_32_54/0.22),0_0_0_2px_var(--ring)]"
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
                  <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  <span className="shrink-0 font-medium">{label}</span>
                  {kind === "profile" && <ProfileDetail snapshot={snapshot} />}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => onToggle(kind)}
                    className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-muted transition-[background-color,color] hover:bg-muted hover:text-fg"
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
          className="block max-h-56 min-h-[3.75rem] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-base leading-6 outline-none placeholder:text-fg-muted"
        />

        <div className="flex items-center px-3 pb-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Add context"
                className={`${iconButton} text-fg-muted hover:bg-subtle hover:text-fg active:bg-border data-[state=open]:bg-subtle data-[state=open]:text-fg`}
              >
                <Plus aria-hidden />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="start"
                sideOffset={8}
                className="z-50 min-w-60 rounded-lg bg-bg p-1 shadow-float outline-none"
              >
                <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-medium text-fg-muted text-xs">
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
                      <Icon aria-hidden className="size-4 text-fg-muted" />
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
            <Tooltip content="Coming soon">
              <button
                type="button"
                aria-label="Mode, Balanced"
                aria-disabled
                className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md px-2.5 font-medium text-fg-muted text-sm opacity-50"
              >
                Balanced
                <ChevronDown aria-hidden className="size-4" />
              </button>
            </Tooltip>

            <button
              type="submit"
              aria-label="Send message"
              disabled={!value.trim()}
              className={`${iconButton} bg-primary text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.22),inset_0_1px_0_rgb(255_255_255/0.22)] hover:bg-primary-hover active:translate-y-px active:shadow-[inset_0_1px_2px_rgb(23_32_54/0.18)] disabled:pointer-events-none disabled:opacity-50`}
            >
              <ArrowUp aria-hidden strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </form>
      <p className="mt-3 text-center text-fg-muted text-xs">
        The advisor can make mistakes. Check important details in the{" "}
        <Link
          href="/courses"
          className="underline underline-offset-2 hover:text-fg"
        >
          course catalogue
        </Link>
        .
      </p>
    </div>
  );
}
