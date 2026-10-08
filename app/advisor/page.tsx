import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { AdvisorChat } from "@/components/advisor/advisor-chat";

// Only the greeting uses it, so only this route loads it.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: "normal",
  axes: ["opsz"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = { title: "Advisor" };

export default function AdvisorPage() {
  return (
    <div className={newsreader.variable}>
      <AdvisorChat />
    </div>
  );
}
