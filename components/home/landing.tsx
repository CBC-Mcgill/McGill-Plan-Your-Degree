import { CalendarRange, FileUp, ListChecks } from "lucide-react";
import {
  SampleRow,
  SampleTag,
  StartActions,
  sampleTerm,
} from "@/components/no-profile";
import { STATUS, type Status, StatusBar } from "@/components/status";
import { CARD } from "@/components/ui/card";
import { termLabel } from "@/lib/profile/term-options";

/** A made-up student's terms, from last term to later, by offset from today's term. */
const PREVIEW: {
  offset: number | null;
  rows: { code: string; title: string; status: Status }[];
}[] = [
  {
    offset: -1,
    rows: [
      {
        code: "COMP 250",
        title: "Introduction to Computer Science",
        status: "completed",
      },
    ],
  },
  {
    offset: 0,
    rows: [
      {
        code: "COMP 251",
        title: "Algorithms and Data Structures",
        status: "in-progress",
      },
      {
        code: "COMP 273",
        title: "Introduction to Computer Systems",
        status: "in-progress",
      },
    ],
  },
  {
    offset: 1,
    rows: [
      { code: "COMP 310", title: "Operating Systems", status: "planned" },
      { code: "COMP 303", title: "Software Design", status: "available" },
    ],
  },
  {
    offset: null,
    rows: [
      { code: "COMP 409", title: "Concurrent Programming", status: "locked" },
    ],
  },
];

const PROMISES = [
  {
    icon: FileUp,
    title: "Start from your transcript",
    text: "Drop the unofficial transcript PDF from Minerva and every course you took fills in.",
  },
  {
    icon: ListChecks,
    title: "See what you can take",
    text: "Each course checks its prerequisites against what you have done, and says what is missing.",
  },
  {
    icon: CalendarRange,
    title: "Plan every term",
    text: "Lay out each term until graduation, with a warning when a course does not run or a prerequisite is late.",
  },
];

export function Landing() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <h1 className="text-[56px] leading-[60px]">
        Your McGill degree, mapped out
      </h1>
      <div className="mt-10 grid grid-cols-12 items-start gap-x-12">
        <div className="col-span-5">
          <p className="text-pretty text-fg-muted text-xl">
            See what you can take next, what is left to graduate, and a plan for
            every term that checks each prerequisite.
          </p>
          <div className="mt-8">
            <StartActions />
          </div>
        </div>

        <figure className="col-span-7">
          <figcaption className="mb-3 flex items-center gap-4 text-fg-muted">
            A Computer Science student in {termLabel(sampleTerm(0))}
            <SampleTag />
          </figcaption>
          <div aria-hidden className={CARD}>
            <div className="px-5 pt-4 pb-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold">36 of 90 credits earned</p>
                <p className="text-fg-muted">
                  Graduates {termLabel(sampleTerm(3))}
                </p>
              </div>
              <StatusBar
                completed={36}
                inProgress={12}
                planned={3}
                total={90}
                className="mt-3 w-full"
              />
            </div>
            {PREVIEW.map(({ offset, rows }) => (
              <div key={offset ?? "later"} className="border-line border-t">
                <p className="flex h-9 items-center border-line border-b bg-subtle px-5 font-semibold text-fg-muted">
                  {offset === null ? "Later" : termLabel(sampleTerm(offset))}
                </p>
                <ul>
                  {rows.map((row) => (
                    <SampleRow
                      key={row.code}
                      {...row}
                      word={STATUS[row.status].label}
                      className="px-5 first:border-t-0"
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </figure>
      </div>

      <ul className="mt-20 grid grid-cols-3 gap-12 border-line border-t pt-8">
        {PROMISES.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon aria-hidden className="size-5 text-fg-muted" />
            <h2 className="mt-3 text-base leading-6">{title}</h2>
            <p className="mt-1 text-fg-muted">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
