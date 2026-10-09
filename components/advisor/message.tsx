import Link from "next/link";

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

export function UserMessage({ text }: { text: string }) {
  return (
    <p className="max-w-[80%] self-end whitespace-pre-wrap break-words rounded-lg bg-tint px-4 py-2">
      <span className="sr-only">You: </span>
      {text}
    </p>
  );
}

export function AssistantMessage({ prompt }: { prompt: string }) {
  return (
    <div className="grid gap-2">
      <span className="sr-only">Advisor: </span>
      {reply(prompt).map((pieces) => (
        <p key={pieces.map((p) => (typeof p === "string" ? p : p.href)).join()}>
          {pieces.map((piece) =>
            typeof piece === "string" ? (
              piece
            ) : (
              <Link
                key={piece.href}
                href={piece.href}
                className="link font-semibold"
              >
                {piece.label}
              </Link>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
