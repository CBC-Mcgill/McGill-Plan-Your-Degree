import { StartActions } from "@/components/no-profile";
import { type Status, StatusBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { COPY } from "@/lib/copy";

const EXAMPLE: { code: string; title: string; status: Status }[] = [
  {
    code: "COMP 202",
    title: "Foundations of Programming",
    status: "completed",
  },
  {
    code: "COMP 250",
    title: "Intro to Computer Science",
    status: "in-progress",
  },
  { code: "COMP 206", title: "Intro to Software Systems", status: "planned" },
  { code: "MATH 240", title: "Discrete Structures", status: "available" },
  {
    code: "COMP 251",
    title: "Algorithms and Data Structures",
    status: "locked",
  },
];

export function Landing() {
  return (
    <div className="mx-auto grid w-full max-w-page grid-cols-12 items-start px-8 py-12">
      <div className="col-span-6">
        <h1 className="text-[56px] leading-[60px]">
          Your McGill degree, mapped out
        </h1>
        <p className="mt-6 max-w-[480px] text-pretty text-fg-muted text-xl">
          Import your unofficial transcript to see what you can take next and
          what is left to graduate. {COPY.privacy}
        </p>
        <div className="mt-8">
          <StartActions />
        </div>
      </div>

      <Card className="col-span-5 col-start-8 px-5 py-2">
        <figure>
          <figcaption className="py-3 text-fg-muted">Example</figcaption>
          <ul>
            {EXAMPLE.map(({ code, title, status }) => (
              <li
                key={code}
                className="-mx-5 flex h-11 items-center gap-4 border-line border-t px-5"
              >
                <span className="w-20 shrink-0 font-semibold">{code}</span>
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <StatusBadge status={status} />
              </li>
            ))}
          </ul>
        </figure>
      </Card>
    </div>
  );
}
