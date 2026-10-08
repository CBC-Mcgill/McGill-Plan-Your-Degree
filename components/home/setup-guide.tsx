"use client";

import { cn } from "cn";
import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { Sentence as WarningSentence } from "@/components/plan/term-warnings";
import { StatusIcon } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { planWarnings } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { plannedCredits } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { defaultGraduation, termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";
import type { Program } from "@/lib/programs/types";

const DISMISSED_KEY = "plan-your-degree:setup-guide-dismissed";
/** Full time at McGill. */
const FULL_TIME_CREDITS = 12;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(DISMISSED_KEY, "1");
    else localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // The guide just comes back next visit when storage is blocked.
  }
}

interface Step {
  id: string;
  title: string;
  done: boolean;
  /** Shown on the right once the step is done. */
  detail: string;
  /** Shown when the step is open. */
  sentence: ReactNode;
  action: { label: string; href?: string; run?: () => void };
}

/** Five steps that check themselves from the profile. The student can collapse the guide or dismiss it for good. */
export function SetupGuide({
  snapshot,
  catalogue,
  program,
  term,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  term: Term;
}) {
  const recordCount = useProfileStore((state) => state.records.length);
  const plan = useProfileStore((state) => state.plan);
  const importedAt = useProfileStore((state) => state.importedAt);
  const startTerm = useProfileStore((state) => state.startTerm);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const setTerms = useProfileStore((state) => state.setTerms);

  const [dismissed, setDismissed] = useState(readDismissed);
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const warnings = useMemo(
    () => planWarnings(plan, snapshot, catalogue, creditLimit),
    [plan, snapshot, catalogue, creditLimit],
  );
  const label = termLabel(term);
  const plannedNext = (
    plan.find((entry) => termKey(entry.term) === termKey(term))?.courses ?? []
  ).reduce((sum, code) => sum + plannedCredits(catalogue.get(code)), 0);
  const graduationGuess = defaultGraduation(startTerm ?? term);

  const steps: Step[] = [
    {
      id: "transcript",
      title: "Import your transcript",
      done: importedAt !== null,
      detail: `${recordCount} ${recordCount === 1 ? "course" : "courses"} found`,
      sentence:
        "Import your unofficial transcript from Minerva to see what you can take next. The PDF never leaves this browser.",
      action: { label: "Import transcript", href: "/profile" },
    },
    {
      id: "program",
      title: "Pick your program",
      done: program !== null,
      detail: program?.name ?? "",
      sentence:
        "Choose your program so we can list the required courses you still need.",
      action: { label: "Pick program", href: "/profile" },
    },
    {
      id: "graduation",
      title: "Set your graduation term",
      done: graduationTerm !== null,
      detail: graduationTerm ? termLabel(graduationTerm) : "",
      sentence: `Most degrees take eight terms, which would end in ${termLabel(graduationGuess)}. You can change it later.`,
      action: {
        label: `Use ${termLabel(graduationGuess)}`,
        run: () => setTerms({ graduationTerm: graduationGuess }),
      },
    },
    {
      id: "plan",
      title: `Fill ${label}`,
      done: plannedNext >= FULL_TIME_CREDITS,
      detail: `${plannedNext} credits planned`,
      sentence: `Full time is ${FULL_TIME_CREDITS} credits or more, and ${label} has ${plannedNext} so far. Your must-take courses are listed below.`,
      action: {
        label: "See courses",
        run: () => {
          const target = document.getElementById("next-up");
          target?.scrollIntoView({ block: "center" });
          target?.querySelector("button")?.focus({ preventScroll: true });
        },
      },
    },
    {
      id: "warnings",
      title: "Clear every warning",
      done: plan.length > 0 && warnings.length === 0,
      detail: "No warnings in your plan",
      sentence: warnings[0] ? (
        <>
          <WarningSentence
            warning={warnings[0]}
            snapshot={snapshot}
            catalogue={catalogue}
            plan={plan}
          />
          {warnings.length > 1 && ` And ${warnings.length - 1} more.`}
        </>
      ) : (
        "Once you plan a term, we check prerequisites, offered terms and your credit limit for you."
      ),
      action: { label: "Open planner", href: "/plan" },
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const firstOpen = steps.find((step) => !step.done)?.id ?? null;
  const open = picked === null ? firstOpen : picked || null;
  const isCollapsed = collapsed ?? allDone;

  const setGuideDismissed = (next: boolean) => {
    writeDismissed(next);
    setDismissed(next);
  };

  if (dismissed) {
    return (
      <p>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5"
          onClick={() => setGuideDismissed(false)}
        >
          Show setup guide
        </Button>
      </p>
    );
  }

  return (
    <Card asChild>
      <section aria-labelledby="setup-guide">
        <div className="flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            <h2 id="setup-guide" className="text-base leading-6">
              Setup guide
            </h2>
            <p className="text-[13px] text-muted-foreground leading-[18px]">
              {allDone
                ? "You are all set. Nice work."
                : "A few steps to get your plan ready. They check themselves off."}
            </p>
          </div>
          <div className="-mt-1 -mr-2 flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                isCollapsed ? "Expand setup guide" : "Collapse setup guide"
              }
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed(!isCollapsed)}
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  "transition-transform motion-reduce:transition-none",
                  !isCollapsed && "rotate-180",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss setup guide"
              onClick={() => setGuideDismissed(true)}
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 pt-3 pb-4">
          <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
            {doneCount} of {steps.length} steps done
          </p>
          <ProgressBar
            value={doneCount}
            max={steps.length}
            label={`${doneCount} of ${steps.length} setup steps done`}
            className="w-40"
          />
        </div>
        {!isCollapsed && (
          <ol className="border-border border-t">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                open={open === step.id}
                onToggle={() => setPicked(open === step.id ? "" : step.id)}
              />
            ))}
          </ol>
        )}
      </section>
    </Card>
  );
}

function StepRow({
  step,
  open,
  onToggle,
}: {
  step: Step;
  open: boolean;
  onToggle: () => void;
}) {
  const { action } = step;
  return (
    <li className="border-border border-b last:border-b-0">
      {step.done ? (
        <div className="flex h-11 items-center gap-3 px-5">
          <StatusIcon status="completed" size={16} />
          <span className="font-medium text-muted-foreground">
            {step.title}
          </span>
          <span
            className="ml-auto truncate text-[13px] text-muted-foreground"
            title={step.detail}
          >
            {step.detail}
          </span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex h-11 w-full items-center gap-3 px-5 text-left transition-colors hover:bg-subtle"
          >
            <StatusIcon status="available" size={16} />
            <span className="font-semibold">{step.title}</span>
            <ChevronDown
              aria-hidden
              className={cn(
                "ml-auto size-4 text-muted-foreground transition-transform motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
          {open && (
            <div className="flex flex-col items-start gap-3 pr-5 pb-4 pl-12">
              <p className="max-w-[560px] text-muted-foreground">
                {step.sentence}
              </p>
              {action.href ? (
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button onClick={action.run}>{action.label}</Button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}
