import type { Metadata } from "next";
import { Planner } from "@/components/plan/planner";

export const metadata: Metadata = { title: "Planner" };

export default function PlanPage() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-5 px-8 pt-8 pb-12">
      <h1>Planner</h1>
      <Planner />
    </div>
  );
}
