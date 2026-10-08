"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Spark } from "@/components/advisor/spark";

export function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  const [query, setQuery] = useState("");

  return (
    <aside
      aria-label="Chats"
      className="flex w-64 shrink-0 flex-col gap-5 border-border border-r bg-card p-3"
    >
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 items-center gap-2.5 rounded-md px-2 font-semibold text-[0.9375rem] transition-[background-color] hover:bg-muted"
        >
          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
          </span>
          New chat
        </button>
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-9 text-sm placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <section aria-labelledby="recents" className="grid gap-2">
        <h2
          id="recents"
          className="px-2 font-semibold font-stretch-normal text-muted-foreground text-xs tracking-normal"
        >
          Recents
        </h2>
        <p className="px-2 text-muted-foreground text-sm">
          {query.trim()
            ? "No chats match your search"
            : "Your chats will show up here"}
        </p>
      </section>

      <div className="mt-auto rounded-lg bg-background p-3.5">
        <p className="flex items-center gap-2 font-semibold text-sm">
          <Spark className="size-4 text-primary" />
          Preview
        </p>
        <p className="mt-1.5 text-muted-foreground text-sm leading-5">
          The advisor is coming soon. For now this chat only shows how it will
          work. Nothing you type is saved or sent anywhere.
        </p>
      </div>
    </aside>
  );
}
