"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const DISMISS_MS = 5000;

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

function dismiss(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

function act(item: Toast) {
  item.action?.run();
  dismiss(item.id);
}

/** A short success message at the bottom left, gone after 5 seconds. A new toast replaces the old one. Errors never use a toast. */
export function toast(message: string, action?: Toast["action"]) {
  current = { id: nextId++, message, action };
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const isMac = () => /Mac/.test(navigator.userAgent);

/** Renders the toast. Mounted once in the layout. */
export function Toaster() {
  const item = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  // Cmd+Z or Ctrl+Z runs the Undo that is showing, unless the student is typing, where it undoes their text.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !current?.action ||
        event.key.toLowerCase() !== "z" ||
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.repeat ||
        isTextField(event.target)
      ) {
        return;
      }
      event.preventDefault();
      act(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // On a phone a toast sits above the transcript review's save bar instead of over Save.
    <div
      aria-live="polite"
      className="fixed bottom-6 left-6 z-[70] max-md:inset-x-4 max-md:bottom-4 max-md:[body:has([data-save-bar])_&]:bottom-[calc(7rem+env(safe-area-inset-bottom))]"
    >
      {item && <ToastCard key={item.id} item={item} />}
    </div>
  );
}

function ToastCard({ item }: { item: Toast }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismiss(item.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, paused]);

  const shortcut = isMac() ? "⌘Z" : "Ctrl+Z";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pausing on hover only delays the dismissal
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex h-10 items-center gap-4 rounded-md bg-fg pr-1 pl-4 text-white shadow-float transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none max-md:h-12 max-md:justify-between"
    >
      {item.message}
      {item.action ? (
        <button
          type="button"
          title={`${item.action.label} (${shortcut})`}
          aria-keyshortcuts={isMac() ? "Meta+Z" : "Control+Z"}
          onClick={() => act(item)}
          className="h-8 rounded-md px-3 font-semibold underline-offset-3 hover:underline focus-visible:outline-white max-md:h-11 max-md:px-4"
        >
          {item.action.label}
        </button>
      ) : (
        <span className="w-3" />
      )}
    </div>
  );
}
