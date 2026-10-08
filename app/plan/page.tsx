import type { Metadata } from "next";
import { Planner } from "@/components/plan/planner";

export const metadata: Metadata = { title: "Planner" };

export default function PlanPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <h1 className="text-4xl">Planner</h1>
      <Planner />
    </div>
  );
}
