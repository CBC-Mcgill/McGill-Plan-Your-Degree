import type { Transcript } from "./parse.ts";

// Kept apart from index.ts so the page can use these without bundling pdf.js.
export type ImportError =
  | "not-pdf"
  | "too-large"
  | "too-many-pages"
  | "unreadable"
  | "timeout"
  | "not-transcript";

export const IMPORT_ERROR_MESSAGES: Record<ImportError, string> = {
  "not-pdf":
    "This file is not a PDF. Save your unofficial transcript from Minerva as a PDF and try again.",
  "too-large":
    "This PDF is larger than 5 MB. An unofficial transcript is much smaller, so check that you picked the right file.",
  "too-many-pages":
    "This PDF has more than 20 pages. An unofficial transcript is much shorter, so check that you picked the right file.",
  unreadable:
    "This PDF could not be read. It may be damaged or password protected. Print your transcript to PDF again and retry.",
  timeout:
    "Reading this PDF took too long, so we stopped. Check that you picked your unofficial transcript, or print it to PDF again and retry.",
  "not-transcript":
    "This PDF is not a McGill unofficial transcript. In Minerva, open Student Records, then View Your Unofficial Transcript, and print that page to PDF.",
};

export type ReadResult =
  | { ok: true; transcript: Transcript }
  | { ok: false; error: ImportError; message: string };
