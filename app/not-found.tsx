import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12 max-md:px-4">
      <div className="max-w-reading">
        <h1>Page not found</h1>
        <p className="mt-2 text-fg-muted">
          Check the link, or find the course in the course list.
        </p>
        <Button asChild className="mt-8 max-md:h-11">
          <Link href="/courses">Browse courses</Link>
        </Button>
      </div>
    </div>
  );
}
