"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const DISMISS_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

function dismiss(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

/** A short success message at the bottom center, gone after 5 seconds. Errors never use a toast. */
export function toast(message: string, action?: Toast["action"]) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, action }];
  emit();
  setTimeout(() => dismiss(id), DISMISS_MS);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const NONE: Toast[] = [];

/** Renders the toasts. Mounted once in the layout. */
export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => NONE,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2"
    >
      <AnimatePresence initial={false}>
        {list.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg bg-foreground pr-1.5 pl-4 font-medium text-[13px] text-white shadow-float"
          >
            {item.message}
            {item.action ? (
              <button
                type="button"
                onClick={() => {
                  item.action?.run();
                  dismiss(item.id);
                }}
                className="h-7 rounded-md px-2.5 font-semibold text-[#9ec0ff] hover:bg-white/10 focus-visible:outline-white"
              >
                {item.action.label}
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
