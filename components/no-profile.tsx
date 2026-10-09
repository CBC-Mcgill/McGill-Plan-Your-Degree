"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import { startProfile } from "@/lib/profile/started";

/** The visitor state of a page that needs a profile (D34): the h1, one sentence and the two ways to start. */
export function NoProfile({ title, lede }: { title: string; lede: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="mt-2 max-w-[560px] text-pretty text-fg-muted">{lede}</p>
      <div className="mt-6">
        <StartActions />
      </div>
    </div>
  );
}

/** Import a transcript, or start an empty profile and stay on this page. */
export function StartActions() {
  return (
    <div className="flex items-center gap-4">
      <Button asChild>
        <Link href="/profile">{COPY.importTranscript}</Link>
      </Button>
      <Button variant="secondary" onClick={startProfile}>
        {COPY.startWithout}
      </Button>
    </div>
  );
}
