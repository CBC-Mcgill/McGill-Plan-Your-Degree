"use client";

import Link from "next/link";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";

/** A course code that links to its page, or plain text when the catalogue has no such course. */
export function CourseLink({
  code,
  label = code,
}: {
  code: string;
  /** What the link says, such as ECSE 458D1 for a link to ECSE 458. */
  label?: string;
}) {
  const catalogue = useCatalogue();
  if (catalogue.status === "ready" && !catalogue.catalogue.has(code)) {
    return <span className="font-semibold">{label}</span>;
  }
  return (
    <Link
      href={`/courses/${courseSlug(code)}`}
      prefetch={false}
      className="link font-semibold"
    >
      {label}
    </Link>
  );
}
