import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseBrowser } from "@/components/course-browser";
import { CourseRowSkeleton } from "@/components/course-row";

export const metadata: Metadata = { title: "Browse courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-10">
      <h1>Browse courses</h1>
      <Suspense
        fallback={
          <div className="mt-8">
            <CourseRowSkeleton rows={14} />
          </div>
        }
      >
        <CourseBrowser />
      </Suspense>
    </div>
  );
}
