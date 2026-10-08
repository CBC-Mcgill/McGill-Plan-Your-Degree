import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseBrowser } from "@/components/course-browser";
import { CourseRowSkeleton } from "@/components/course-row";

export const metadata: Metadata = { title: "Browse courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <h1 className="text-4xl">Browse courses</h1>
      <Suspense
        fallback={
          <div className="mt-8">
            <CourseRowSkeleton />
          </div>
        }
      >
        <CourseBrowser />
      </Suspense>
    </div>
  );
}
