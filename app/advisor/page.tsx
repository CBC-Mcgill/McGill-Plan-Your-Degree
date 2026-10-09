import type { Metadata } from "next";
import { AdvisorChat } from "@/components/advisor/advisor-chat";
import { COPY } from "@/lib/copy";

export const metadata: Metadata = { title: COPY.advisor };

export default function AdvisorPage() {
  return <AdvisorChat />;
}
