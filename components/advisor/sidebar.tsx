"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Spark } from "@/components/advisor/spark";

export function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  const [query, setQuery] = useState("");

  return (
    <aside
      aria-label="Chats"
      className="flex w-64 shrink-0 flex-col gap-5 border-border border-r bg-bg p-3"
    >
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 items-center gap-2.5 rounded-md px-2 font-medium transition-[background-color] hover:bg-subtle"
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
            className="h-9 w-full rounded-md bg-bg pr-3 pl-9 text-fg text-sm shadow-[inset_0_0_0_1px_var(--fg-subtle)] placeholder:text-fg-muted"
          />
        </label>
      </div>

      <section aria-labelledby="recents" className="grid gap-2">
        <p id="recents" className="px-2 font-medium text-fg-muted text-xs">
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
