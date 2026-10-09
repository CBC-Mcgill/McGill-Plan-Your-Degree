import { MotionConfig } from "motion/react";
import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { Celebration } from "@/components/celebration";
import { CommandPalette } from "@/components/command-palette";
import { SiteHeader } from "@/components/site-header";
import { StorageBanner } from "@/components/storage-banner";
import { Toaster } from "@/components/toast";
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
    default: "McGill Plan Your Degree",
    template: "%s | McGill Plan Your Degree",
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
          <a
            href="#main"
            className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-card px-4 py-2 font-semibold shadow-float focus:translate-y-0"
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
          <footer className="border-border border-t">
            <p className="mx-auto max-w-page px-8 py-6 text-[13px] text-muted-foreground leading-[18px]">
              Plan Your Degree is open source on{" "}
              <a
                href="https://github.com/CBC-Mcgill/McGill-Plan-Your-Degree"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                GitHub
              </a>
              . Not affiliated with McGill University.
            </p>
          </footer>
          <CommandPalette />
          <Toaster />
          <Celebration />
        </MotionConfig>
      </body>
    </html>
  );
}
