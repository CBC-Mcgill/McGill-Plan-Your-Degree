import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planner" };

export default function PlanPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-14">
      <h1 className="text-4xl">Planner</h1>
      <p className="mt-3 max-w-prose text-lg text-muted-foreground">
        Soon you can lay out your remaining terms here and check every
        prerequisite before you register.
      </p>
    </div>
  );
}
