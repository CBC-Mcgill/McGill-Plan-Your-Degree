import type { Metadata } from "next";
import { Planner } from "@/components/plan/planner";

export const metadata: Metadata = { title: "Planner" };

export default function PlanPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12 max-md:px-4 max-md:py-6">
      <Planner />
    </div>
  );
}
