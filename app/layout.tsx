import { MotionConfig } from "motion/react";
import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette";
import { SiteHeader } from "@/components/site-header";
import { StorageBanner } from "@/components/storage-banner";
import { Toaster } from "@/components/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: {
    default: "Plan Your Degree",
    template: "%s | Plan Your Degree",
  },
  description:
    "Browse McGill courses, import your transcript, and plan your degree.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <a
              href="#main"
              className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-bg px-4 py-2 font-semibold shadow-float focus:translate-y-0"
            >
              Skip to main content
            </a>
            <SiteHeader />
            <StorageBanner />
            <main
              id="main"
              tabIndex={-1}
              className="flex flex-1 flex-col focus:outline-none"
            >
              {children}
            </main>
            <footer className="mx-auto flex w-full max-w-page items-baseline justify-between gap-8 px-8 pt-24 pb-8 text-fg-muted">
              <p>
                Open source on{" "}
                <a
                  href="https://github.com/CBC-Mcgill/McGill-Plan-Your-Degree"
                  className="link"
                >
                  GitHub
                </a>
                . Not affiliated with McGill University.
              </p>
              <Link href="/advisor" className="link">
                {COPY.advisor}
              </Link>
            </footer>
            <CommandPalette />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
