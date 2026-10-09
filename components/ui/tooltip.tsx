"use client";

import { Tooltip as Primitive } from "radix-ui";
import { type FocusEvent, type ReactNode, useRef, useState } from "react";
import type { Definition } from "@/lib/glossary";

/** One provider for the app, so every tooltip shares one short delay. No skip window, so sliding the pointer down a list does not open a tooltip on every row. */
function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={150} skipDelayDuration={0}>
      {children}
    </Primitive.Provider>
  );
}

/** Radix closes a tooltip on scroll, which tabbing to a trigger below the fold causes, so open again once the scroll has passed, unless Escape closed it. */
function useOpen() {
  const [open, onOpenChange] = useState(false);
  const escaped = useRef(false);
  function onFocus({ target }: FocusEvent) {
    escaped.current = false;
    const settle = () => {
      if (
        !escaped.current &&
        target instanceof HTMLElement &&
        document.activeElement === target &&
        target.matches(":focus-visible")
      ) {
        onOpenChange(true);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));
  }
  const onEscapeKeyDown = () => {
    escaped.current = true;
  };
  return { open, onOpenChange, onFocus, onEscapeKeyDown };
}

function Bubble({
  side = "top",
  align = "center",
  onEscapeKeyDown,
  children,
}: {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onEscapeKeyDown: () => void;
  children: ReactNode;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        side={side}
        align={align}
        onEscapeKeyDown={onEscapeKeyDown}
        sideOffset={8}
        collisionPadding={16}
        arrowPadding={10}
        className="z-[100] max-w-80 rounded-md bg-fg px-3 py-2 text-sm text-white shadow-float transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none"
      >
        {children}
        <Primitive.Arrow width={12} height={6} className="fill-fg" />
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/** A dark label for the one element inside, shown on hover and keyboard focus. The child must pass a ref and props on to a DOM element. */
function Tooltip({
  content,
  side,
  align,
  children,
}: {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  children: ReactNode;
}) {
  const { open, onOpenChange, onFocus, onEscapeKeyDown } = useOpen();
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger asChild onFocus={onFocus}>
        {children}
      </Primitive.Trigger>
      <Bubble side={side} align={align} onEscapeKeyDown={onEscapeKeyDown}>
        {content}
      </Bubble>
    </Primitive.Root>
  );
}

/** A term with a dotted underline that shows its definition on hover and focus. A click toggles it. On an h2 it drops the underline, which is too heavy at that size. Never put one inside a link or a button. */
function Term({ def, children }: { def: Definition; children?: ReactNode }) {
  const { open, onOpenChange, onFocus, onEscapeKeyDown } = useOpen();
  // A click that closes it should keep it closed until the pointer leaves, not reopen on the next hover tick.
  const closedByClick = useRef(false);
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!(next && closedByClick.current)) onOpenChange(next);
      }}
    >
      <Primitive.Trigger
        asChild
        onFocus={onFocus}
        onPointerLeave={() => {
          closedByClick.current = false;
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            closedByClick.current = open;
            onOpenChange(!open);
          }}
          className="cursor-help text-left underline decoration-1 decoration-dotted decoration-fg-subtle underline-offset-3 [h2_&]:no-underline"
        >
          {children ?? def.label}
        </button>
      </Primitive.Trigger>
      <Bubble onEscapeKeyDown={onEscapeKeyDown}>{def.tip}</Bubble>
    </Primitive.Root>
  );
}

export { Term, Tooltip, TooltipProvider };
