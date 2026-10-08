import { FileUp } from "lucide-react";
import Link from "next/link";
import { type Status, StatusIcon, StatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const examplePath: { code: string; title: string; status: Status }[] = [
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

export function Landing() {
  return (
    <div className="mx-auto my-auto grid w-full max-w-page grid-cols-[1.1fr_1fr] items-center gap-12 px-8 py-16">
      <div>
        <h1 className="text-5xl leading-[1.05]">
          Your McGill degree, mapped out
        </h1>
        <p className="mt-5 max-w-[34rem] text-base text-muted-foreground leading-relaxed">
          Import your unofficial transcript to see which courses you can take
          next, what you still need to graduate, and a plan for every term that
          checks each prerequisite.
        </p>
        <div className="mt-9 flex items-center gap-4">
          <Button asChild size="lg">
            <Link href="/profile">
              <FileUp aria-hidden />
              Import your transcript
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      </div>

      <Card asChild className="p-5">
        <figure>
          <figcaption className="font-medium text-[13px] text-muted-foreground leading-[18px]">
            Example path for a Computer Science student
          </figcaption>
          <ol className="mt-3">
            {examplePath.map(({ code, title, status }, i) => (
              <li
                key={code}
                className="relative flex items-center gap-3 py-2.5"
              >
                {i < examplePath.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-[7px] h-full w-0.5 bg-border"
                  />
                )}
                <span className="relative flex bg-card py-1">
                  <StatusIcon status={status} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{code}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {title}
                  </span>
                </span>
                <StatusLabel status={status} />
              </li>
            ))}
          </ol>
        </figure>
      </Card>
    </div>
  );
}
