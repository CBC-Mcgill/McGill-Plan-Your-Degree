import type { Metadata } from "next";
import { Requirements } from "@/components/requirements";

export const metadata: Metadata = { title: "Requirements" };

export default function RequirementsPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-10">
      <Requirements />
    </div>
  );
}
