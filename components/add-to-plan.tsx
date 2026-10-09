"use client";

import { Check, ChevronDown, FileUp, Plus, X } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { flushSync } from "react-dom";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { StatusIcon } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/lib/catalogue/client";
import type { CourseSummary } from "@/lib/catalogue/types";
import { list } from "@/lib/engine/parts";
import {
  courseLoads,
  loadsTerms,
  type TermChoice,
  termChoices,
} from "@/lib/engine/plan";
import { courseStatus, isOffered } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm } from "@/lib/profile/terms";
import { type Term, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

/** The page's one primary action: plan the course for the next term it runs, in any other term of the school period, or take it back out. Courses the student has taken or is taking have none. `year` is the catalogue year. */
export function AddToPlan({
  course,
  year,
}: {
  course: CourseSummary;
  year: string;
}) {
  const snapshot = useSnapshot();

  if (snapshot === undefined) return null;
  if (snapshot === null) {
    return (
      <Button asChild size="lg">
        <Link href="/profile">
          <FileUp aria-hidden />
          Import your transcript
        </Link>
      </Button>
    );
  }
  const { status, blockedBy } = courseStatus(course, snapshot);
  if (
    status === "completed" ||
    status === "covered" ||
    status === "in-progress"
  )
    return null;

  return (
    <PlanActions
      course={course}
      year={year}
      locked={status === "locked"}
      reason={
        blockedBy.length > 0
          ? "Blocked by a course you took"
          : "Missing prerequisites"
      }
    />
  );
}

function PlanActions({
  course,
  year,
  locked,
  reason,
}: {
  course: CourseSummary;
  year: string;
  locked: boolean;
  reason: string;
}) {
  const catalogue = useCatalogue();
  const plan = useProfileStore((state) => state.plan);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const root = useRef<HTMLDivElement>(null);
  const picked = useRef(false);

  const planned = plan.find((entry) =>
    entry.courses.includes(course.code),
  )?.term;
  const ready = catalogue.status === "ready";
  const choices = termChoices(
    course,
    plan,
    ready ? catalogue.catalogue : new Map(),
    graduationTerm,
    currentTerm(),
  );
  const next = choices.find((choice) => choice.offered && !choice.endsAfter);
  const never = !(["Fall", "Winter", "Summer"] as const).some((season) =>
    isOffered(course, season),
  );
  const menu = {
    choices,
    limit: ready ? creditLimit : null,
    never,
    year,
    onClose: (event: Event) => {
      if (!picked.current) return;
      picked.current = false;
      event.preventDefault();
      focusFirst();
    },
  };

  // The control the student used is gone after a change, so keep keyboard focus on the first one that is left.
  function focusFirst() {
    root.current?.querySelector("button")?.focus();
  }

  function pick(term: Term) {
    if (planned && termKey(planned) === termKey(term)) return;
    picked.current = true;
    addWithUndo(term, course.code);
  }

  function act(run: () => void) {
    flushSync(run);
    focusFirst();
  }

  const terms = (start: Term) =>
    loadsTerms(courseLoads(course.code, course, start));

  return (
    <div ref={root} className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        {planned ? (
          <>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-planned">
              <StatusIcon status="planned" />
              Planned for {terms(planned)}
            </span>
            <TermMenu
              {...menu}
              title="Move to a term"
              current={planned}
              onPick={pick}
              trigger={
                <Button variant="secondary" size="lg">
                  Move
                  <ChevronDown aria-hidden />
                </Button>
              }
            />
            <Button
              variant="secondary"
              size="lg"
              onClick={() => act(() => removeWithUndo(planned, course.code))}
            >
              <X aria-hidden />
              Remove
              <span className="sr-only"> from {terms(planned)}</span>
            </Button>
          </>
        ) : next ? (
          <div className="flex">
            <Button
              size="lg"
              className="rounded-r-none focus-visible:relative focus-visible:z-10"
              onClick={() => act(() => addWithUndo(next.term, course.code))}
            >
              <Plus aria-hidden />
              Add to {next.label}
              {locked && " anyway"}
            </Button>
            <TermMenu
              {...menu}
              title="Add to a term"
              onPick={pick}
              trigger={
                <Button
                  size="lg"
                  aria-label="Choose a term"
                  className="w-9 rounded-l-none border-primary-foreground/30 border-l px-0"
                >
                  <ChevronDown aria-hidden />
                </Button>
              }
            />
          </div>
        ) : (
          <TermMenu
            {...menu}
            title="Add to a term"
            onPick={pick}
            trigger={
              <Button variant="secondary" size="lg">
                <Plus aria-hidden />
                Add to a term{locked && " anyway"}
                <ChevronDown aria-hidden />
              </Button>
            }
          />
        )}
      </div>
      {locked && (
        <p className="text-[13px] text-muted-foreground leading-[18px]">
          {reason}
        </p>
      )}
    </div>
  );
}

/** What a choice cannot do or does badly, shown as a tag. */
function tagOf(choice: TermChoice, never: boolean, year: string) {
  if (choice.endsAfter) return "Ends after graduation";
  if (choice.offered) return null;
  return never ? `Not offered in ${year}` : "Not offered";
}

/** Every term in the school period, with the credits it holds. Terms where the course does not run stay selectable and the planner warns. `current` marks the term the course is planned in. */
function TermMenu({
  trigger,
  title,
  choices,
  current,
  limit,
  never,
  year,
  onPick,
  onClose,
}: {
  trigger: ReactNode;
  title: string;
  choices: TermChoice[];
  current?: Term;
  /** Credits per term before the planner warns, or null while the catalogue loads and the credits are unknown. */
  limit: number | null;
  never: boolean;
  year: string;
  onPick: (term: Term) => void;
  onClose: (event: Event) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          onCloseAutoFocus={onClose}
          className="z-[85] max-h-[min(400px,var(--radix-dropdown-menu-content-available-height))] min-w-72 overflow-y-auto rounded-lg bg-card p-1 shadow-float outline-none"
        >
          <DropdownMenu.Label className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs leading-4">
            {title}
          </DropdownMenu.Label>
          {choices.map((choice) => {
            const here =
              current !== undefined &&
              termKey(current) === termKey(choice.term);
            const tag = tagOf(choice, never, year);
            return (
              <DropdownMenu.Item
                key={termKey(choice.term)}
                disabled={choice.endsAfter}
                onSelect={() => onPick(choice.term)}
                className="flex h-9 cursor-default select-none items-center gap-3 rounded-md px-2 text-[13px] outline-none data-[disabled]:text-faint data-[highlighted]:option-active"
              >
                {current && (
                  <span className="flex size-4 shrink-0">
                    {here && <Check aria-hidden className="size-4" />}
                  </span>
                )}
                <span className="flex-1 whitespace-nowrap">
                  {choice.label}
                  {here && <span className="sr-only"> (current term)</span>}
                </span>
                {tag && (
                  <Badge tone={choice.endsAfter ? "neutral" : "warn"}>
                    {tag}
                  </Badge>
                )}
                {limit !== null && (
                  <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                    {list.format(choice.planned.map(String))} of {limit} credits
                  </span>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
