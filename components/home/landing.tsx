import { StartActions } from "@/components/no-profile";
import { STATUS, type Status, StatusIcon } from "@/components/status";
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
    <div className="mx-auto grid w-full max-w-page grid-cols-12 items-start px-8 pt-12">
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

      <figure className="col-span-5 col-start-8">
        <figcaption className="text-fg-muted">Example</figcaption>
        <ul className="mt-4">
          {EXAMPLE.map(({ code, title, status }) => (
            <li key={code} className="flex h-11 items-center gap-4">
              <span className="flex shrink-0 items-center gap-2">
                <StatusIcon status={status} size={16} />
                <span className="w-20 font-semibold">{code}</span>
              </span>
              <span className="min-w-0 flex-1 truncate text-fg-muted">
                {title}
              </span>
              <span className="shrink-0 text-fg-muted">
                {STATUS[status].label}
              </span>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
