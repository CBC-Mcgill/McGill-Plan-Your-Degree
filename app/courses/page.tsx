import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseBrowser } from "@/components/course-browser";
import { BrowseSkeleton } from "@/components/course-row";

export const metadata: Metadata = { title: "Browse courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 pt-8 pb-24">
      <h1>Browse courses</h1>
      <div className="mt-5">
        <Suspense fallback={<BrowseSkeleton />}>
          <CourseBrowser />
        </Suspense>
      </div>
    </div>
  );
}
