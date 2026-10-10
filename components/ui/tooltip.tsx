"use client";

import { cn } from "cn";
import { Info } from "lucide-react";
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
  // A touch screen has no hover, so a tap toggles the tooltip, from how it stood before the press.
  const touchOpen = useRef<boolean | null>(null);
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger
        asChild
        onFocus={onFocus}
        onPointerDown={(event) => {
          touchOpen.current = event.pointerType === "touch" ? open : null;
        }}
        onClick={() => {
          if (touchOpen.current === null) return;
          onOpenChange(!touchOpen.current);
          touchOpen.current = null;
        }}
      >
        {children}
      </Primitive.Trigger>
      <Bubble side={side} align={align} onEscapeKeyDown={onEscapeKeyDown}>
        {content}
      </Bubble>
    </Primitive.Root>
  );
}

/** A small button that shows a definition on hover and focus. A click toggles it and Escape closes it. Never put one inside a link or a button. */
function DefinitionButton({
  def,
  label,
  className,
  children,
}: {
  def: Definition;
  /** The button's name for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { open, onOpenChange, onFocus, onEscapeKeyDown } = useOpen();
  // A click that closes it should keep it closed until the pointer leaves, not reopen on the next hover tick.
  const closedByClick = useRef(false);
  // Radix closes an open tooltip on pointer down, so a click toggles from how it stood before the press.
  const openAtPress = useRef<boolean | null>(null);
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
          openAtPress.current = null;
        }}
        onPointerDown={() => {
          openAtPress.current = open;
        }}
      >
        <button
          type="button"
          aria-label={label}
          onClick={(event) => {
            event.preventDefault();
            const wasOpen = openAtPress.current ?? open;
            openAtPress.current = null;
            closedByClick.current = wasOpen;
            onOpenChange(!wasOpen);
          }}
          className={cn(
            "relative inline-flex cursor-help items-center justify-center rounded-full after:absolute after:-inset-1",
            className,
          )}
        >
          {children}
        </button>
      </Primitive.Trigger>
      <Bubble onEscapeKeyDown={onEscapeKeyDown}>{def.tip}</Bubble>
    </Primitive.Root>
  );
}

/** The small info icon that shows a definition, named "About" the term for screen readers. */
function InfoButton({ def }: { def: Definition }) {
  return (
    <DefinitionButton
      def={def}
      label={`About ${def.label}`}
      className="ml-1 size-4 align-middle text-fg-muted hover:text-fg data-[state=delayed-open]:text-fg data-[state=instant-open]:text-fg"
    >
      <Info aria-hidden className="size-4" strokeWidth={1.75} />
    </DefinitionButton>
  );
}

/** A term in plain text with the info icon after it, which shows the definition. The two never wrap apart. Never put one inside a link or a button. */
function Term({ def, children }: { def: Definition; children?: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      {children ?? def.label}
      <InfoButton def={def} />
    </span>
  );
}

export { DefinitionButton, InfoButton, Term, Tooltip, TooltipProvider };
