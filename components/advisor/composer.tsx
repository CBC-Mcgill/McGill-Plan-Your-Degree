"use client";

import { ArrowUp } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";

/** The message field, outlined like any input, with Send at its bottom right. Enter sends and Shift+Enter starts a new line. */
export function Composer({
  value,
  onChange,
  onSend,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      className="rounded-md border border-fg-subtle has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-ring has-[textarea:focus-visible]:outline-offset-2"
    >
      <textarea
        ref={textareaRef}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        aria-label="Message the advisor"
        placeholder="Ask anything about your degree"
        className="block w-full resize-none bg-transparent px-3 pt-2 placeholder:text-fg-muted focus-visible:outline-none"
      />
      <div className="flex justify-end p-2">
        <Button type="submit" disabled={!value.trim()}>
          <ArrowUp aria-hidden />
          Send
        </Button>
      </div>
    </form>
  );
}
