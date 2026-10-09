"use client";

import { cn } from "cn";
import {
  Check,
  ChevronRight,
  Copy,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { Spark } from "@/components/advisor/spark";
import { Tooltip } from "@/components/ui/tooltip";

type Piece = string | { href: string; label: string };

/** What the advisor will help with, matched to the student's message. */
const TOPICS: [RegExp, string][] = [
  [
    /prereq|unlock|chain/i,
    "trace the prerequisite chain behind a course and show what it unlocks",
  ],
  [
    /elective|enjoy|interest/i,
    "suggest electives that fit your interests and still count toward your program",
  ],
  [
    /graduat|track|requirement|degree/i,
    "compare your record with your program requirements and tell you what is left before you graduate",
  ],
  [
    /plan|term|semester|schedule/i,
    "draft a balanced term from the courses you can take and your credit limit",
  ],
];
const GENERAL_TOPIC =
  "answer questions about your courses and degree using your profile and the catalogue";

function reply(prompt: string): Piece[][] {
  const topic = TOPICS.find(([match]) => match.test(prompt))?.[1];
  return [
    [
      `The advisor is coming soon, so I can't answer that properly yet. Once it is live, it will ${topic ?? GENERAL_TOPIC}.`,
    ],
    [
      "In the meantime, ",
      { href: "/next", label: "What's next" },
      " shows the courses you can take now, and the ",
      { href: "/plan", label: "Planner" },
      " lays them out term by term.",
    ],
  ];
}

const plainText = (paragraphs: Piece[][]) =>
  paragraphs
    .map((pieces) =>
      pieces.map((p) => (typeof p === "string" ? p : p.label)).join(""),
    )
    .join("\n\n");

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-fg font-semibold text-bg text-xs"
      >
        Y
      </span>
      <p className="w-fit max-w-full whitespace-pre-wrap break-words rounded-[16px] bg-muted px-4 py-2 leading-6">
        <span className="sr-only">You: </span>
        {text}
      </p>
    </div>
  );
}

const word = { hidden: { opacity: 0 }, show: { opacity: 1 } };

function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <motion.span
      // biome-ignore lint/suspicious/noArrayIndexKey: the words never reorder
      key={i}
      variants={word}
      transition={{ duration: 0.25 }}
    >
      {w}{" "}
    </motion.span>
  ));
}

function Thinking() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduce = useReducedMotion();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="-ml-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-fg-muted transition-[color] hover:text-fg"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        Thinking
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 mb-1 ml-2 grid gap-2 border-border border-l pl-4 text-[13px] text-fg-muted leading-5">
              <p>
                Nothing ran for this message, because the advisor is still being
                built. Once it ships, it will:
              </p>
              <ol className="grid list-decimal gap-1 pl-5">
                <li>Read your profile for your courses, program, and plan.</li>
                <li>
                  Check your program requirements for what is done and what is
                  left.
                </li>
                <li>
                  Search the catalogue for courses, prerequisites, and when they
                  run.
                </li>
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Action({
  label,
  tip = "Coming soon",
  onClick,
  children,
}: {
  label: string;
  tip?: string;
  /** Without a handler the action is disabled. It stays focusable so keyboard users can reach the tooltip. */
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={tip}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={onClick ? undefined : true}
        onClick={onClick}
        className="grid size-7 place-items-center rounded-md text-fg-muted transition-[background-color,color] hover:bg-subtle hover:text-fg aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-fg-muted [&_svg]:size-4"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Action
      label={copied ? "Copied" : "Copy"}
      tip={copied ? "Copied" : "Copy"}
      onClick={copy}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Action>
  );
}

export function AssistantMessage({ prompt }: { prompt: string }) {
  const reduce = useReducedMotion();
  const paragraphs = reply(prompt);

  return (
    <div className="group flex items-start gap-3">
      <Spark className="mt-1 size-7 p-0.5 text-primary" />
      <div className="min-w-0 flex-1">
        <span className="sr-only">Advisor: </span>
        <Thinking />
        <motion.div
          initial={reduce ? false : "hidden"}
          animate="show"
          transition={{ staggerChildren: 0.02, delayChildren: 0.1 }}
          className="mt-1 grid gap-3 leading-6"
        >
          {paragraphs.map((pieces) => (
            <p
              key={pieces
                .map((p) => (typeof p === "string" ? p : p.href))
                .join()}
            >
              {pieces.map((piece) =>
                typeof piece === "string" ? (
                  <Words key={piece} text={piece} />
                ) : (
                  <motion.span
                    key={piece.href}
                    variants={word}
                    transition={{ duration: 0.25 }}
                  >
                    <Link
                      href={piece.href}
                      className="font-medium underline underline-offset-2 hover:text-primary"
                    >
                      {piece.label}
                    </Link>
                  </motion.span>
                ),
              )}
            </p>
          ))}
        </motion.div>
        <div className="mt-2 -ml-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <CopyAction text={plainText(paragraphs)} />
          <Action label="Retry">
            <RotateCcw aria-hidden />
          </Action>
          <Action label="Good answer">
            <ThumbsUp aria-hidden />
          </Action>
          <Action label="Bad answer">
            <ThumbsDown aria-hidden />
          </Action>
        </div>
      </div>
    </div>
  );
}
