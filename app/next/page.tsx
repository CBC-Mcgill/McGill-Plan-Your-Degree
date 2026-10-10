import type { Metadata } from "next";
import { WhatsNext } from "@/components/whats-next";

export const metadata: Metadata = { title: "What's next" };

export default function NextPage() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12 max-md:px-4 max-md:py-8">
      <WhatsNext />
    </div>
  );
}
