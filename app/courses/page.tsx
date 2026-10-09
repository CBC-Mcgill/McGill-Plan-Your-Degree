import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseBrowser } from "@/components/course-browser";
import { BrowseSkeleton } from "@/components/course-row";

export const metadata: Metadata = { title: "Browse courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 pt-12">
      <h1 className="sr-only">Browse courses</h1>
      <Suspense fallback={<BrowseSkeleton />}>
        <CourseBrowser />
      </Suspense>
    </div>
  );
}
