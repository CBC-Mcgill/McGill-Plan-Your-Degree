"use client";

import { cn } from "cn";
import { PanelLeft, Plus, Search, SquarePen, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useId, useState } from "react";
import { Spark } from "@/components/advisor/spark";

export function Sidebar({
  onNewChat,
  className,
}: {
  onNewChat: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const recents = useId();

  return (
    <aside
      aria-label="Chats"
      className={cn(
        "flex w-64 shrink-0 flex-col gap-5 border-border border-r bg-bg p-3",
        className,
      )}
    >
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 items-center gap-2.5 rounded-md px-2 font-medium transition-[background-color] hover:bg-subtle max-md:h-11"
        >
          <span className="grid size-5 place-items-center rounded-[6px] bg-muted text-fg">
            <Plus aria-hidden className="size-3.5" strokeWidth={2.25} />
          </span>
          New chat
        </button>
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="h-9 w-full rounded-md bg-bg pr-3 pl-9 text-fg text-sm shadow-[inset_0_0_0_1px_var(--fg-subtle)] placeholder:text-fg-muted max-md:h-11 max-md:text-base"
          />
        </label>
      </div>

      <section aria-labelledby={recents} className="grid gap-2">
        <p id={recents} className="px-2 font-medium text-fg-muted text-xs">
          Recents
        </p>
        <p className="px-2 text-[13px] text-fg-muted">
          {query.trim()
            ? "No chats match your search"
            : "Your chats will show up here"}
        </p>
      </section>

      <div className="mt-auto rounded-lg bg-subtle p-3 shadow-[inset_0_0_0_1px_var(--border)]">
        <p className="flex items-center gap-2 font-medium">
          <Spark className="size-4 text-primary" />
          Preview
        </p>
        <p className="mt-1.5 text-[13px] text-fg-muted leading-[18px]">
          The advisor is coming soon. For now this chat only shows how it will
          work. Nothing you type is saved or sent anywhere.
        </p>
      </div>
    </aside>
  );
}

const ICON_BUTTON =
  "grid size-11 place-items-center rounded-md text-fg-muted hover:bg-tint hover:text-fg [&_svg]:size-5";

/** On a phone the sidebar waits behind a Chats button, as a sheet from the left, with New chat beside it. */
export function PhoneChatBar({ onNewChat }: { onNewChat: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between px-2 md:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger aria-label="Chats" className={ICON_BUTTON}>
          <PanelLeft aria-hidden strokeWidth={1.75} />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-3rem)] flex-col bg-bg pb-[env(safe-area-inset-bottom)] shadow-float transition-[translate] duration-200 starting:-translate-x-full motion-reduce:transition-none"
          >
            <div className="flex h-14 shrink-0 items-center justify-between pr-1 pl-5">
              <Dialog.Title>Chats</Dialog.Title>
              <Dialog.Close aria-label="Close chats" className={ICON_BUTTON}>
                <X aria-hidden strokeWidth={1.75} />
              </Dialog.Close>
            </div>
            <Sidebar
              onNewChat={() => {
                setOpen(false);
                onNewChat();
              }}
              className="w-full flex-1 border-r-0 pt-0"
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button
        type="button"
        aria-label="New chat"
        onClick={onNewChat}
        className={ICON_BUTTON}
      >
        <SquarePen aria-hidden strokeWidth={1.75} />
      </button>
    </div>
  );
}
