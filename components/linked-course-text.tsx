import Link from "next/link";
import type { ReactNode } from "react";
import { loadCatalogue } from "@/lib/catalogue/server";
import { courseSlug } from "@/lib/catalogue/slug";
import { logicalCode } from "@/lib/profile/types";

// Matches COMP 251, ECSE 458D1 and NUR1 200.
const CODE = /\b[A-Z][A-Z0-9]{3} \d{3}[A-Z0-9]{0,2}\b/g;

/** The text as written, with every course code that exists in the catalogue linked to its page. Server only. */
export async function LinkedCourseText({ text }: { text: string }) {
  const catalogue = await loadCatalogue();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE)) {
    const code = logicalCode(match[0]);
    if (!catalogue.has(code)) continue;
    parts.push(
      text.slice(last, match.index),
      <Link
        key={match.index}
        href={`/courses/${courseSlug(code)}`}
        className="font-semibold text-in-progress underline underline-offset-2 hover:text-foreground"
      >
        {match[0]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
