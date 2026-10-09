"use client";

import { cn } from "cn";
import { Info } from "lucide-react";
import { Tooltip as Primitive } from "radix-ui";
import { type FocusEvent, type ReactNode, useRef, useState } from "react";

/** One provider for the app, so every tooltip shares the same delay and moves between triggers without waiting again. */
function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={300} skipDelayDuration={150}>
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
        className="z-[100] max-w-[280px] rounded-md bg-foreground px-3 py-2 text-[13px] text-white leading-[18px] shadow-float transition-opacity duration-100 starting:opacity-0 motion-reduce:transition-none"
      >
        {children}
        <Primitive.Arrow width={12} height={6} className="fill-foreground" />
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/** A navy label for the one element inside, shown on hover and keyboard focus. The child must pass a ref and props on to a DOM element. */
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

/** A 16px "i" button beside a label that defines it. Unlike a plain trigger, a click keeps the definition open. */
function InfoTip({
  label,
  tip,
  className,
}: {
  label: string;
  tip: ReactNode;
  className?: string;
}) {
  const { open, onOpenChange, onFocus, onEscapeKeyDown } = useOpen();
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger asChild onFocus={onFocus}>
        <button
          type="button"
          aria-label={`About ${label}`}
          onClick={(event) => {
            event.preventDefault();
            onOpenChange(true);
          }}
          className={cn(
            "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-faint transition-colors after:absolute after:-inset-1 hover:text-foreground data-[state=delayed-open]:text-foreground data-[state=instant-open]:text-foreground",
            className,
          )}
        >
          <Info aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      </Primitive.Trigger>
      <Bubble onEscapeKeyDown={onEscapeKeyDown}>{tip}</Bubble>
    </Primitive.Root>
  );
}

export { InfoTip, Tooltip, TooltipProvider };
