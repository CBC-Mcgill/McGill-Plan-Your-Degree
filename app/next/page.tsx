import type { Metadata } from "next";
import { WhatsNext } from "@/components/whats-next";

export const metadata: Metadata = { title: "What's next" };

export default function NextPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <WhatsNext />
    </div>
  );
}
