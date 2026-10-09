"use client";

import { AnimatePresence, motion } from "motion/react";
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

/** A short success message at the bottom center, gone after 5 seconds. A new toast replaces the old one. Errors never use a toast. */
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
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center"
    >
      <AnimatePresence initial={false} mode="wait">
        {item && <ToastCard key={item.id} item={item} />}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg bg-foreground pr-1.5 pl-4 font-medium text-[13px] text-white shadow-float"
    >
      {item.message}
      {item.action ? (
        <button
          type="button"
          title={`${item.action.label} (${shortcut})`}
          aria-keyshortcuts={isMac() ? "Meta+Z" : "Control+Z"}
          onClick={() => act(item)}
          className="h-7 rounded-md px-2.5 font-semibold text-[#9ec0ff] hover:bg-white/10 focus-visible:outline-white"
        >
          {item.action.label}
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </motion.div>
  );
}
