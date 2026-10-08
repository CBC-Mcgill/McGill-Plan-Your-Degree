"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addWithUndo } from "@/components/plan/add-with-undo";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import type { CourseSummary } from "@/lib/catalogue/types";
import { isOffered } from "@/lib/engine/status";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { termFromKey, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

/** Picks a term and puts the course in the plan. Without a profile it sends the student to import one. */
export function AddToPlan({ course }: { course: CourseSummary }) {
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
