"use client";

import { cn } from "cn";
import Link from "next/link";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";

/** A course code that links to its page, or plain text when the catalogue has no such course. */
export function CourseLink({
  code,
  label = code,
  className,
}: {
  code: string;
  /** What the link says, such as ECSE 458D1 for a link to ECSE 458. */
  label?: string;
  className?: string;
}) {
  const catalogue = useCatalogue();
  if (catalogue.status === "ready" && !catalogue.catalogue.has(code)) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Link
      href={`/courses/${courseSlug(code)}`}
      prefetch={false}
      className={cn(
        "font-semibold text-in-progress underline underline-offset-2 hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}
