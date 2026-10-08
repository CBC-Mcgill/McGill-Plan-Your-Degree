import type { Metadata } from "next";

export const metadata: Metadata = { title: "Browse courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-14">
      <h1 className="text-4xl">Browse courses</h1>
      <p className="mt-3 max-w-prose text-lg text-muted-foreground">
        Soon you can search every McGill course here and see which ones you can
        take.
      </p>
    </div>
  );
}
