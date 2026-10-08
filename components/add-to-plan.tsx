"use client";

import Link from "next/link";
import { type Ref, useEffect, useMemo, useRef, useState } from "react";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import type { CourseSummary } from "@/lib/catalogue/types";
import { isOffered } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { type Term, termFromKey, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

/** Picks a term and puts the course in the plan. Without a profile it sends the student to import one. Pass `term` for a one-click button into that term. */
export function AddToPlan({
  course,
  term,
}: {
  course: CourseSummary;
  term?: Term;
}) {
  return term ? (
    <AddToTerm course={course} term={term} />
  ) : (
    <PickTerm course={course} />
  );
}

/** The "Planned" mark that links to the planner. */
export function PlannedLink({
  code,
  ref,
}: {
  code: string;
  ref?: Ref<HTMLAnchorElement>;
}) {
  return (
    <Link
      ref={ref}
      href="/plan"
      aria-label={`Planned: ${code}. View your plan`}
      className="inline-flex h-7 items-center rounded-md px-2 transition-colors hover:bg-subtle"
    >
      <StatusLabel status="planned" />
    </Link>
  );
}

function AddToTerm({ course, term }: { course: CourseSummary; term: Term }) {
  const planned = useProfileStore((state) =>
    state.plan.some((entry) => entry.courses.includes(course.code)),
  );
  const link = useRef<HTMLAnchorElement>(null);
  const justAdded = useRef(false);

  // The button turns into the link, so move focus along with it.
  useEffect(() => {
    if (planned && justAdded.current) {
      justAdded.current = false;
      link.current?.focus();
    }
  }, [planned]);

  if (planned) return <PlannedLink code={course.code} ref={link} />;
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`Add to ${termLabel(term)}, ${course.code}`}
      onClick={() => {
        justAdded.current = true;
        addWithUndo(term, course.code);
      }}
    >
      Add to {termLabel(term)}
    </Button>
  );
}

function PickTerm({ course }: { course: CourseSummary }) {
  const snapshot = useSnapshot();
  const plan = useProfileStore((state) => state.plan);
  const options = useMemo(() => planTermOptions(plan), [plan]);
  const [picked, setPicked] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (snapshot === undefined) return <div className="h-[8.5rem]" />;
  if (snapshot === null) {
    return (
      <Button asChild>
        <Link href="/profile">Import your transcript</Link>
      </Button>
    );
  }

  const planned = plan.find((entry) => entry.courses.includes(course.code));
  const fallback =
    planned?.term ??
    options.find((term) => isOffered(course, term.season)) ??
    options[0];
  const selected = picked ?? (fallback ? termKey(fallback) : null);
  const term = selected === null ? null : termFromKey(selected);

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Term"
        value={selected ?? ""}
        onChange={(event) => {
          setPicked(Number(event.target.value));
          setNotice(null);
        }}
      >
        {options.map((option) => (
          <option key={termKey(option)} value={termKey(option)}>
            {termLabel(option)}
          </option>
        ))}
      </SelectField>
      <div>
        <Button
          className="w-full"
          onClick={() => {
            if (!term) return;
            addWithUndo(term, course.code);
            setNotice(`${planned ? "Moved" : "Added"} to ${termLabel(term)}.`);
          }}
        >
          {planned ? "Move to this term" : "Add to plan"}
        </Button>
        <p role="status" className="mt-3 min-h-5">
          {notice && (
            <>
              {notice}{" "}
              <Link
                href="/plan"
                className="font-medium underline underline-offset-2 hover:text-primary"
              >
                View your plan
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
