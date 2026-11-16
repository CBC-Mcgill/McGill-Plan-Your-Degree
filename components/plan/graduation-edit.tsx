"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { TermSelect } from "@/components/profile/selects";
import { Button } from "@/components/ui/button";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";

const SELECT_ID = "graduation-edit";

/** A link-styled button that edits the expected graduation in a popover, so the student fixes it without leaving the plan. */
export function GraduationEdit({ children }: { children: ReactNode }) {
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const setTerms = useProfileStore((state) => state.setTerms);
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
          className="rounded-md underline decoration-1 underline-offset-3 max-lg:relative max-lg:after:absolute max-lg:after:-inset-x-2 max-lg:after:-inset-y-3"
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
            document.getElementById(SELECT_ID)?.focus();
          }}
          // Saving can remove the trigger, such as the notice for a graduation that has passed.
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected) return;
            event.preventDefault();
            document.getElementById("main")?.focus({ preventScroll: true });
          }}
          className="z-[85] w-72 max-w-[calc(100vw-32px)] rounded-lg bg-bg p-4 text-fg shadow-float outline-none transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
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
              id={SELECT_ID}
              label={GLOSSARY.graduation.label}
              info={GLOSSARY.graduation}
              notBefore={currentTerm()}
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
