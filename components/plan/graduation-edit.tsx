"use client";

import { cn } from "cn";
import Link from "next/link";
import { Popover } from "radix-ui";
import { type ReactNode, useId, useRef, useState } from "react";
import { TermSelect } from "@/components/profile/selects";
import { Button } from "@/components/ui/button";
import { FLOATING } from "@/components/ui/card";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm } from "@/lib/profile/term-options";
import { compareTerms, type Term } from "@/lib/profile/types";

/** A link-styled button that edits the expected graduation in a popover, so the student fixes it without leaving the plan. */
export function GraduationEdit({ children }: { children: ReactNode }) {
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const startTerm = useProfileStore((state) => state.startTerm);
  const setTerms = useProfileStore((state) => state.setTerms);
  const selectId = useId();
  // A graduation before the start term leaves no path, and with it no Change button.
  const now = currentTerm();
  const earliest =
    startTerm && compareTerms(startTerm, now) > 0 ? startTerm : now;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Term | null>(graduationTerm);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(graduationTerm);
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className="rounded-md underline decoration-1 underline-offset-3 max-lg:relative max-lg:after:absolute max-lg:after:-inset-x-2 max-lg:after:-inset-y-3.5"
        >
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          // The info button comes first, and focusing it would open its tooltip over the picker.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(selectId)?.focus();
          }}
          // Saving can remove the trigger, such as the notice for a graduation that has passed.
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected) return;
            event.preventDefault();
            document.getElementById("main")?.focus({ preventScroll: true });
          }}
          className={cn(FLOATING, "w-72 max-w-[calc(100vw-32px)] p-4")}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setTerms({ graduationTerm: draft });
              setOpen(false);
            }}
          >
            <TermSelect
              id={selectId}
              label={GLOSSARY.graduation.label}
              info={GLOSSARY.graduation}
              notBefore={earliest}
              value={draft}
              onChange={setDraft}
              className="max-lg:[&_select]:h-11 max-lg:[&_select]:text-base"
            />
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/profile#graduation"
                className="text-[13px] text-fg-muted underline decoration-1 underline-offset-3 hover:text-fg"
              >
                Also on your profile
              </Link>
              <Button type="submit" variant="secondary" className="max-lg:h-11">
                Save
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
