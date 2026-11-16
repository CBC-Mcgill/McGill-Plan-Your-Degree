import type { Metadata } from "next";
import { PlanPage } from "@/components/plan/plan-page";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12 max-md:px-4 max-md:py-6">
      <PlanPage />
    </div>
  );
}
