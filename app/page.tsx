import { FileUp } from "lucide-react";
import Link from "next/link";
import { type CourseStatus, StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";

const examplePath: { code: string; title: string; status: CourseStatus }[] = [
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
  {
    code: "COMP 251",
    title: "Algorithms and Data Structures",
    status: "available",
  },
  { code: "COMP 206", title: "Intro to Software Systems", status: "planned" },
  { code: "COMP 310", title: "Operating Systems", status: "locked" },
];

const nodeColor: Record<CourseStatus, string> = {
  completed: "bg-completed",
  "in-progress": "bg-in-progress",
  available: "bg-available",
  planned: "bg-planned",
  locked: "bg-locked",
};

export default function Home() {
  return (
    <div className="mx-auto my-auto grid w-full max-w-6xl grid-cols-[1.1fr_1fr] items-center gap-12 px-8 py-16">
      <div>
        <h1 className="text-5xl leading-[1.05] xl:text-6xl">
          Your McGill degree, mapped out
        </h1>
        <p className="mt-5 max-w-[34rem] text-lg text-muted-foreground leading-relaxed">
          Import your unofficial transcript to see which courses you can take
          next, what you still need to graduate, and a plan for every term that
          checks each prerequisite.
        </p>
        <div className="mt-9 flex items-center gap-4">
          <Button asChild>
            <Link href="/profile">
              <FileUp aria-hidden />
              Import your transcript
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      </div>

      <figure className="rounded-lg border-2 border-border-strong bg-card p-6 shadow-edge">
        <figcaption className="font-semibold text-muted-foreground text-sm">
          Example path for a Computer Science student
        </figcaption>
        <ol className="mt-4">
          {examplePath.map(({ code, title, status }, i) => (
            <li key={code} className="relative flex items-center gap-4 py-3">
              {i < examplePath.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-[7px] h-full w-0.5 bg-border-strong"
                />
              )}
              <span
                aria-hidden
                className={`relative size-4 shrink-0 rounded-full ring-4 ring-card ${nodeColor[status]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{code}</span>
                <span className="block truncate text-muted-foreground text-sm">
                  {title}
                </span>
              </span>
              <StatusChip status={status} />
            </li>
          ))}
        </ol>
      </figure>
    </div>
  );
}
