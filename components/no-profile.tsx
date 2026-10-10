"use client";

import { cn } from "cn";
import { GraduationCap, Lock } from "lucide-react";
import Link from "next/link";
import { CourseCode } from "@/components/course-code";
import { STATUS, type Status, StatusIcon } from "@/components/status";
import { Button } from "@/components/ui/button";
import { BAND, CARD } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import { startProfile } from "@/lib/profile/started";
import { currentTerm, termLabel } from "@/lib/profile/term-options";
import { type Term, termFromKey, termKey } from "@/lib/profile/types";

/** The visitor state of a page that needs a profile (D34): the h1, one sentence and the two ways to start, beside a sample of the page. */
export function NoProfile({
  title,
  lede,
  sample,
}: {
  title: string;
  lede: string;
  sample: "next" | "plan";
}) {
  const next = sampleTerm(1);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_33rem] items-start gap-10 max-lg:grid-cols-1 max-md:gap-8 xl:gap-14">
      <div className="pt-4 max-md:pt-0">
        <h1>{title}</h1>
        <p className="mt-3 max-w-[30rem] text-pretty text-fg-muted">{lede}</p>
        <div className="mt-6">
          <StartActions />
        </div>
      </div>
      <figure className={CARD}>
        <figcaption className={BAND}>
          <span className="text-fg-muted">
            {sample === "next"
              ? `What's next for ${termLabel(next)}`
              : "Your path to graduation"}
          </span>
          <SampleTag />
        </figcaption>
        <div aria-hidden className="px-5 pt-3 pb-4">
          {sample === "next" ? <NextSample /> : <PlanSample />}
        </div>
      </figure>
    </div>
  );
}

/** Import a transcript, or start an empty profile and stay on this page, with the privacy promise under them. */
function StartActions() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:[&>*]:h-11">
        <Button asChild>
          <Link href="/profile">{COPY.importTranscript}</Link>
        </Button>
        <Button variant="secondary" onClick={startProfile}>
          {COPY.startWithout}
        </Button>
      </div>
      <p className="mt-6 flex items-start gap-2 text-fg-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        {COPY.privacy}
      </p>
    </>
  );
}

/** Says the courses beside it are made up, so nobody takes them for their own. */
function SampleTag() {
  return (
    <span className="ml-auto rounded-[6px] bg-tint px-2 font-medium text-[13px] text-fg-muted leading-6">
      Sample
    </span>
  );
}

/** A Fall or Winter term counted from today's, so a sample never looks dated: 0 is this term (the Fall after a Summer), -1 the last, 1 the next. */
export function sampleTerm(offset: number): Term {
  const now = currentTerm();
  let key = termKey(now) + (now.season === "Summer" ? 1 : 0);
  const step = Math.sign(offset);
  for (let i = 0; i < Math.abs(offset); i++) {
    do key += step;
    while (termFromKey(key).season === "Summer");
  }
  return termFromKey(key);
}

/** A made-up course row: glyph, subject tag, title, then an optional status word and credits. */
function SampleRow({
  status,
  code,
  title,
  word,
  credits,
  className,
}: {
  status: Status;
  code: string;
  title: string;
  word?: string;
  credits?: number;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex h-11 items-center gap-3 border-line border-t first:border-t-0",
        className,
      )}
    >
      <StatusIcon status={status} />
      <span className="w-22 shrink-0 font-semibold">
        <CourseCode code={code} />
      </span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {/* A phone keeps the glyph and drops the word, so the title still fits. */}
      {word && (
        <span
          className="shrink-0 max-md:hidden"
          style={{ color: STATUS[status].text }}
        >
          {word}
        </span>
      )}
      {credits !== undefined && (
        <span className="w-6 shrink-0 text-right text-fg-muted">{credits}</span>
      )}
    </li>
  );
}

function Label({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 pb-1">
      <h3>{title}</h3>
      <span className="text-fg-muted">{meta}</span>
    </div>
  );
}

function NextSample() {
  return (
    <>
      <Label title="Required courses" meta="27 of 33 credits" />
      <ul>
        <SampleRow
          status="available"
          code="COMP 303"
          title="Software Design"
          word="Can take"
          credits={3}
        />
        <SampleRow
          status="planned"
          code="COMP 310"
          title="Operating Systems"
          word="Planned"
          credits={3}
        />
      </ul>
      <div className="mt-5">
        <Label title="Complementary courses" meta="3 of 30 credits" />
      </div>
      <ul>
        <SampleRow
          status="available"
          code="COMP 330"
          title="Theory of Computation"
          word="Can take"
          credits={3}
        />
        <SampleRow
          status="available"
          code="COMP 360"
          title="Algorithm Design"
          word="Can take"
          credits={3}
        />
        <SampleRow
          status="locked"
          code="COMP 350"
          title="Numerical Computing"
          word={COPY.notOfferedIn(sampleTerm(1).season)}
          credits={3}
        />
      </ul>
    </>
  );
}

/** The terms of the sample path, two done, this one, the next one picked, and two left. */
const PATH: { offset: number; status: Status; detail: string }[] = [
  { offset: -2, status: "completed", detail: "18 credits" },
  { offset: -1, status: "completed", detail: "15 credits" },
  { offset: 0, status: "in-progress", detail: `${COPY.now} · 12 credits` },
  { offset: 1, status: "planned", detail: "3 credits" },
  { offset: 2, status: "available", detail: "Nothing planned" },
  { offset: 3, status: "available", detail: "Nothing planned" },
];

function PlanSample() {
  const next = termLabel(sampleTerm(1));
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-5 max-md:grid-cols-1">
      <ol>
        {PATH.map(({ offset, status, detail }) => (
          <li
            key={offset}
            className={cn(
              "-mx-2 flex min-h-11 items-start gap-2 px-2 py-1",
              offset === 1 && "selected",
            )}
          >
            <span className="flex h-5 items-center">
              <StatusIcon status={status} />
            </span>
            <span>
              <span className="block font-semibold">
                {termLabel(sampleTerm(offset))}
              </span>
              <span className="block font-normal text-fg-muted">{detail}</span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2 py-1">
          <span className="flex h-5 items-center">
            <span className="grid size-3.5 place-items-center rounded-full text-fg-subtle shadow-[inset_0_0_0_1.5px_currentColor]">
              <GraduationCap className="size-2" strokeWidth={2.5} />
            </span>
          </span>
          <span>
            <span className="block font-semibold">Graduation</span>
            <span className="block text-fg-muted">
              {termLabel(sampleTerm(3))}
            </span>
          </span>
        </li>
      </ol>
      {/* A phone shows the path alone. */}
      <div className="pt-1 max-md:hidden">
        <Label title={next} meta="3 of 17 credits" />
        <ul>
          <SampleRow
            status="planned"
            code="COMP 310"
            title="Operating Systems"
            credits={3}
          />
        </ul>
        <p className="mt-5 pb-1 font-semibold">Needed by your program</p>
        <ul>
          <SampleRow
            status="available"
            code="COMP 303"
            title="Software Design"
            credits={3}
          />
          <SampleRow
            status="available"
            code="COMP 330"
            title="Theory of Computation"
            credits={3}
          />
        </ul>
      </div>
    </div>
  );
}
