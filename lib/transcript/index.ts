import {
  getDocument,
  type PDFDocumentProxy,
  VerbosityLevel,
} from "pdfjs-dist/legacy/build/pdf.mjs";
// Sets globalThis.pdfjsWorker, so pdf.js parses in this thread instead of spawning its own worker.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { parseTranscript } from "./parse";
import {
  IMPORT_ERROR_MESSAGES,
  type ImportError,
  type ReadResult,
} from "./result";

export type {
  CourseStatus,
  Season,
  Term,
  Transcript,
  TranscriptCourse,
} from "./parse";

export { IMPORT_ERROR_MESSAGES, type ImportError, type ReadResult };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PAGES = 20;

const fail = (error: ImportError): ReadResult => ({
  ok: false,
  error,
  message: IMPORT_ERROR_MESSAGES[error],
});

/** Reads a transcript PDF. Call it from a Web Worker in the browser, since pdf.js parses in the calling thread. */
export async function readTranscript(bytes: Uint8Array): Promise<ReadResult> {
  const signature = new TextDecoder().decode(bytes.subarray(0, 5));
  if (signature !== "%PDF-") return fail("not-pdf");
  if (bytes.byteLength > MAX_FILE_BYTES) return fail("too-large");

  const task = getDocument({
    // pdf.js takes ownership of the buffer, so pass a copy.
    data: bytes.slice(),
    verbosity: VerbosityLevel.ERRORS,
    enableXfa: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  try {
    let lines: string[][];
    try {
      const doc = await task.promise;
      if (doc.numPages > MAX_PAGES) return fail("too-many-pages");
      lines = await readLines(doc);
    } catch {
      return fail("unreadable");
    }
    const transcript = parseTranscript(lines);
    return transcript ? { ok: true, transcript } : fail("not-transcript");
  } finally {
    await task.destroy();
  }
}

interface Item {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
}

// Rebuilds visual lines from text items by position, splitting each line into cells at column gaps.
async function readLines(doc: PDFDocumentProxy): Promise<string[][]> {
  const lines: string[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const item of content.items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      const [, , c = 0, d = 0, x = 0, y = 0] = item.transform;
      items.push({
        str: item.str,
        x,
        y,
        width: item.width,
        size: Math.hypot(c, d) || item.height,
      });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows: Item[][] = [];
    for (const item of items) {
      const row = rows.at(-1);
      const first = row?.[0];
      if (row && first && Math.abs(first.y - item.y) < first.size * 0.4) {
        row.push(item);
      } else {
        rows.push([item]);
      }
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let end = Number.NEGATIVE_INFINITY;
      for (const item of row) {
        const gap = item.x - end;
        if (gap > item.size * 0.5 || cells.length === 0) {
          cells.push(item.str);
        } else {
          cells[cells.length - 1] +=
            (gap > item.size * 0.1 ? " " : "") + item.str;
        }
        end = item.x + item.width;
      }
      lines.push(cells.map((c) => c.replace(/\s+/g, " ").trim()));
    }
    page.cleanup();
  }
  return lines;
}
