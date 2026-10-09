"use client";

import { useEffect, useRef, useState } from "react";
import { Composer } from "@/components/advisor/composer";
import { AssistantMessage, UserMessage } from "@/components/advisor/message";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/copy";

const SUGGESTIONS = [
  "Plan my next term",
  "Am I on track to graduate?",
  "Find electives I'd enjoy",
  "Explain a prerequisite chain",
];

export function AdvisorChat() {
  const [turns, setTurns] = useState<{ id: number; prompt: string }[]>([]);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  // Each reply pushes the composer down, so keep it in view.
  useEffect(() => {
    if (turns.length > 0)
      composer.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length]);

  function send() {
    const prompt = draft.trim();
    if (!prompt) return;
    setTurns([...turns, { id: turns.length, prompt }]);
    setDraft("");
  }

  function suggest(text: string) {
    setDraft(text);
    textareaRef.current?.focus();
  }

  return (
    <div className="mx-auto w-full max-w-page px-8 pt-12">
      <div className="max-w-reading">
        <h1>{COPY.advisor}</h1>
        <p className="mt-2 text-fg-muted">
          Coming soon. This preview shows how it will work. Nothing you type is
          saved or sent.
        </p>

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className={
            turns.length === 0 ? "sr-only" : "mt-8 flex flex-col gap-8"
          }
        >
          {turns.map(({ id, prompt }) => (
            <div key={id} className="flex flex-col gap-4">
              <UserMessage text={prompt} />
              <AssistantMessage prompt={prompt} />
            </div>
          ))}
        </div>

        <div ref={composer} className="mt-8 scroll-mb-8">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            textareaRef={textareaRef}
          />
        </div>

        {turns.length === 0 && (
          <ul className="-mx-3 mt-4 grid grid-cols-2">
            {SUGGESTIONS.map((text) => (
              <li key={text}>
                <Button
                  variant="text"
                  onClick={() => suggest(text)}
                  className="w-full justify-start"
                >
                  {text}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
